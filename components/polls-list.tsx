"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Users, 
  Archive, 
  Trash2, 
  CheckCircle2, 
  BarChart3, 
  ChevronDown, 
  ChevronUp,
  Clock
} from "lucide-react"

interface Poll {
  id: number
  title: string
  description?: string
  options: string[]
  status: 'active' | 'archived'
  created_at: string
  created_by: string
  hasVoted?: boolean
  invited_members?: string[]
}

import { useAuth } from "@/contexts/auth-context"

export function PollsList({ rotateKey }: { rotateKey?: number }) {
  const { user } = useAuth()
  const [polls, setPolls] = useState<Poll[]>([])
  const [expandedPoll, setExpandedPoll] = useState<number | null>(null)
  const [votesData, setVotesData] = useState<Record<number, any[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({})
  const [isVoting, setIsVoting] = useState<Record<number, boolean>>({})

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    fetchPolls()
  }, [rotateKey, user])

  const fetchPolls = async () => {
    setIsLoading(true)
    try {
      const url = isAdmin ? "/api/polls" : `/api/polls?memberId=${user?.id}&all=true`
      const response = await fetch(url, { cache: 'no-store' })
      if (response.ok) {
        setPolls(await response.json())
      }
    } catch (error) {
      console.error("Failed to fetch polls:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchVotes = async (pollId: number) => {
    try {
      const response = await fetch(`/api/polls/vote?poll_id=${pollId}`, { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setVotesData(prev => ({ ...prev, [pollId]: data }))
      }
    } catch (error) {
      console.error("Failed to fetch votes:", error)
    }
  }

  const handleArchive = async (id: number) => {
    try {
      const response = await fetch(`/api/polls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 'archived' })
      })
      if (response.ok) {
        fetchPolls()
      }
    } catch (error) {
      console.error("Failed to archive poll:", error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Sigurno želite obrisati ovu anketu i sve njezine glasove?")) return
    try {
      const response = await fetch(`/api/polls/${id}`, { method: "DELETE" })
      if (response.ok) {
        fetchPolls()
      } else {
        const errorData = await response.json()
        alert(errorData.error || "Greška pri brisanju ankete.")
      }
    } catch (error) {
      console.error("Failed to delete poll:", error)
      alert("Došlo je do pogreške prilikom brisanja.")
    }
  }
  const handleVote = async (pollId: number) => {
    const optionIndex = selectedOptions[pollId]
    if (optionIndex === undefined || !user) return

    setIsVoting(prev => ({ ...prev, [pollId]: true }))
    try {
      const response = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poll_id: pollId,
          member_id: user.id,
          option_index: optionIndex
        })
      })

      if (response.ok) {
        fetchPolls()
        fetchVotes(pollId)
      }
    } catch (error) {
      console.error("Voting failed:", error)
    } finally {
      setIsVoting(prev => ({ ...prev, [pollId]: false }))
    }
  }


  const toggleExpand = (pollId: number) => {
    if (expandedPoll === pollId) {
      setExpandedPoll(null)
    } else {
      setExpandedPoll(pollId)
      if (!votesData[pollId]) {
        fetchVotes(pollId)
      }
    }
  }

  if (isLoading) return <div className="text-center py-8">Učitavanje anketa...</div>

  return (
    <div className="space-y-4">
      {polls.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-2" />
          <p className="text-muted-foreground">Nema aktivnih ili arhiviranih glasovanja.</p>
        </div>
      ) : (
        polls.map(poll => (
          <Card key={poll.id} className={`${poll.status === 'archived' ? 'opacity-75 bg-muted/30' : ''}`}>
            <CardHeader className="py-4 px-6 flex flex-row items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={poll.status === 'active' ? 'default' : 'secondary'}>
                    {poll.status === 'active' ? 'Aktivno' : 'Arhivirano'}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {new Date(poll.created_at).toLocaleDateString('hr-HR')}
                  </span>
                </div>
                <CardTitle className="text-lg">{poll.title}</CardTitle>
                {poll.description && (
                  <CardDescription className="line-clamp-1">{poll.description}</CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2">
                {poll.status === 'active' && isAdmin && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => handleArchive(poll.id)}>
                    <Archive className="h-3.5 w-3.5" /> Arhiviraj
                  </Button>
                )}
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(poll.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => toggleExpand(poll.id)}>
                  {expandedPoll === poll.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            
            {expandedPoll === poll.id && (
              <CardContent className="pb-6 px-6 pt-0 border-t">
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" /> Rezultati
                      </h4>
                      <div className="space-y-3">
                        {poll.options.map((option, index) => {
                          const votes = votesData[poll.id] || []
                          const count = votes.filter(v => v.option_index === index).length
                          const percentage = votes.length > 0 ? (count / votes.length) * 100 : 0
                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{option}</span>
                                <span className="font-medium">{count} ({percentage.toFixed(0)}%)</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div 
                                  className="h-full bg-primary" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                        <div className="pt-2 text-xs text-muted-foreground border-t">
                          Ukupno glasalo: {votesData[poll.id]?.length || 0} članova
                        </div>
                      </div>

                      {poll.invited_members && poll.invited_members.length > 0 && (
                        <div className="space-y-4 pt-4 border-t">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Users className="h-4 w-4" /> Pozvani na glasovanje
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {poll.invited_members.map((name, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {!isAdmin && poll.status === 'active' && !poll.hasVoted && (
                      <div className="space-y-4 border-t pt-6 md:border-t-0 md:border-l md:pl-6 md:pt-0">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" /> Vaš glas
                        </h4>
                        <div className="space-y-2">
                          {poll.options.map((option, index) => (
                            <label 
                              key={index} 
                              className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                                selectedOptions[poll.id] === index ? 'bg-primary/5 border-primary' : 'hover:bg-muted'
                              }`}
                            >
                              <input 
                                type="radio" 
                                name={`poll-${poll.id}`} 
                                checked={selectedOptions[poll.id] === index}
                                onChange={() => setSelectedOptions(prev => ({ ...prev, [poll.id]: index }))}
                                className="h-4 w-4 text-primary"
                              />
                              <span className="text-sm">{option}</span>
                            </label>
                          ))}
                        </div>
                        <Button 
                          className="w-full" 
                          disabled={selectedOptions[poll.id] === undefined || isVoting[poll.id]}
                          onClick={() => handleVote(poll.id)}
                        >
                          {isVoting[poll.id] ? "Slanje..." : "Potvrdi glas"}
                        </Button>
                      </div>
                    )}

                    {poll.hasVoted && !isAdmin && (
                      <div className="space-y-2 border-t pt-6 md:border-t-0 md:border-l md:pl-6 md:pt-0 flex flex-col items-center justify-center text-center">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium">Uspješno ste glasovali!</p>
                        <p className="text-xs text-muted-foreground">Vaš glas je zabilježen.</p>
                      </div>
                    )}

                    {(isAdmin || poll.hasVoted || poll.status === 'archived') && (
                      <div className="space-y-2 border-t pt-6 md:border-t-0 md:border-l md:pl-6 md:pt-0">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4" /> Tko je kako glasao
                      </h4>
                      <div className="max-h-60 overflow-auto pr-2">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-background border-b text-muted-foreground">
                            <tr>
                              <th className="text-left py-2 font-medium">Član</th>
                              <th className="text-left py-2 font-medium">Glas</th>
                              <th className="text-right py-2 font-medium">Vrijeme</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {(votesData[poll.id] || []).map(vote => (
                              <tr key={vote.id}>
                                <td className="py-2 font-medium">{vote.member_name}</td>
                                <td className="py-2">
                                  <Badge variant="outline" className="text-[10px] py-0 h-4">
                                    {poll.options[vote.option_index]}
                                  </Badge>
                                </td>
                                <td className="py-2 text-right text-muted-foreground italic">
                                  {new Date(vote.timestamp).toLocaleDateString('hr-HR')} {new Date(vote.timestamp).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                              </tr>
                            ))}
                            {(votesData[poll.id] || []).length === 0 && (
                              <tr>
                                <td colSpan={3} className="py-8 text-center text-muted-foreground italic">
                                  Još nema zabilježenih glasova.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  )
}
