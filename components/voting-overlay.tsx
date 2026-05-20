"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { CheckCircle2, AlertCircle, Users } from "lucide-react"

interface Poll {
  id: number
  title: string
  description?: string
  options: string[]
  target_member_ids: number[] | 'all'
}

export function VotingOverlay() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [activePoll, setActivePoll] = useState<Poll | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [votes, setVotes] = useState<any[]>([])

  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (isAuthLoading) return

    if (user) { 
      fetchPolls()
    } else {
      setIsChecking(false)
    }
  }, [user, isAuthLoading])

  const fetchPolls = async () => {
    if (!user) return
    setIsChecking(true)
    try {
      console.log(`Checking polls for member: ${user.id}`)
      const response = await fetch(`/api/polls?memberId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        console.log(`[VotingOverlay] Found ${data.length} active polls for member ${user.id}`)
        if (data.length > 0) {
          setActivePoll(data[0])
        } else {
          setActivePoll(null)
        }
      }
    } catch (error) {
      console.error("Failed to fetch polls in overlay:", error)
    } finally {
      setIsChecking(false)
    }
  }

  const fetchResults = async (pollId: number) => {
    try {
      const response = await fetch(`/api/polls/vote?poll_id=${pollId}`)
      if (response.ok) {
        setVotes(await response.json())
      }
    } catch (error) {
      console.error("Failed to fetch results:", error)
    }
  }

  const handleVote = async () => {
    if (!activePoll || selectedOption === null || !user) return
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poll_id: activePoll.id,
          member_id: user.id,
          option_index: parseInt(selectedOption)
        })
      })

      if (response.ok) {
        setHasVoted(true)
        await fetchResults(activePoll.id)
        setShowResults(true)
      }
    } catch (error) {
      console.error("Voting failed:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isChecking || isAuthLoading) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Provjera aktivnosti...</p>
        </div>
      </div>
    )
  }

  if (!activePoll) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-[#f8f9fa] opacity-50" />
      <Card className="max-w-2xl w-full shadow-2xl border-primary/20 animate-in fade-in zoom-in duration-500 relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-serif mb-2 text-primary">HRD Glasovanje</CardTitle>
          <CardDescription className="text-lg text-foreground/80">
            Vaše sudjelovanje je <strong>obavezno</strong> za nastavak rada u sustavu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-4 border border-border">
            <h3 className="font-bold text-lg mb-1">{activePoll.title}</h3>
            {activePoll.description && (
              <p className="text-sm text-muted-foreground">{activePoll.description}</p>
            )}
          </div>

          {!showResults ? (
            <RadioGroup
              onValueChange={setSelectedOption}
              className="space-y-3"
            >
              {activePoll.options.map((option, index) => (
                <div
                  key={index}
                  className={`flex items-center space-x-3 space-y-0 rounded-md border p-3 transition-colors ${
                    selectedOption === index.toString() ? "bg-primary/5 border-primary" : "hover:bg-muted"
                  }`}
                >
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <Label
                    htmlFor={`option-${index}`}
                    className="flex-1 cursor-pointer font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Trenutni rezultati
                </span>
                <span className="text-xs text-muted-foreground">{votes.length} glasova</span>
              </div>
              <div className="space-y-3">
                {activePoll.options.map((option, index) => {
                  const count = votes.filter(v => v.option_index === index).length
                  const percentage = votes.length > 0 ? (count / votes.length) * 100 : 0
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{option}</span>
                        <span className="font-medium">{count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {votes.filter(v => v.option_index === index).map(v => (
                          <span key={v.id} className="text-[10px] bg-background border px-1.5 py-0.5 rounded-full text-muted-foreground">
                            {v.member_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {!showResults ? (
            <Button
              className="w-full h-12 text-lg"
              disabled={selectedOption === null || isSubmitting}
              onClick={handleVote}
            >
              {isSubmitting ? "Slanje..." : "Glasuj i nastavi"}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full h-12 text-lg"
              onClick={() => setActivePoll(null)}
            >
              Uđi u CMS
            </Button>
          )}
          <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3" /> Vaš glas će biti zabilježen uz vaše ime i prezime.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
