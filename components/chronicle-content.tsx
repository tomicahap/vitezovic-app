"use client"

import { useMemo } from "react"
import { useMembers } from "@/contexts/members-context"
import { useProjects } from "@/contexts/projects-context"
import { useMeetings } from "@/contexts/meetings-context"
import { useLibrary } from "@/contexts/library-context"
import { useLectures } from "@/contexts/lectures-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, Clipboard } from "lucide-react"
import Link from "next/link"
import { generateChronology } from "@/lib/chronology"

export function ChronicleContent() {
  const { members } = useMembers()
  const { projects } = useProjects()
  const { meetings } = useMeetings()
  const { books } = useLibrary()
  const { lectures } = useLectures()

  const fullTextChronology = useMemo(() => {
    // Collect all payments from all members
    const allPayments: { memberName: string; amount: number; date: string }[] = []
    members.forEach(m => {
      if (m.payments) {
        m.payments.forEach(p => {
          allPayments.push({
            memberName: m.name,
            amount: p.amount,
            date: p.date
          })
        })
      }
    })

    return generateChronology({
      members,
      projects,
      meetings,
      books,
      lectures,
      payments: allPayments
    })
  }, [members, projects, meetings, books, lectures])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullTextChronology)
    alert("Kronologija kopirana u međuspremnik!")
  }

  const downloadText = () => {
    const element = document.createElement("a");
    const file = new Blob([fullTextChronology], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `ljetopis_drustva_${new Date().getFullYear()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 font-medium">
              <ArrowLeft className="h-4 w-4" /> Nazad
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold font-serif italic text-primary">Ljetopis društva</h2>
            <p className="text-muted-foreground text-sm font-medium">
              Službena kronologija rada i povijesti društva.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-2">
            <Clipboard className="h-4 w-4" /> Kopiraj
          </Button>
          <Button variant="outline" size="sm" onClick={downloadText} className="gap-2">
            <Download className="h-4 w-4" /> Preuzmi TXT
          </Button>
        </div>
      </div>

      <Card className="border-primary/20 bg-slate-50/50">
        <CardHeader className="text-center pb-2 border-b mb-6 mx-8">
          <CardTitle className="font-serif text-2xl uppercase tracking-widest text-slate-800">Povijest i kronika rada</CardTitle>
          <CardDescription>Ovaj dokument se automatski generira na temelju svih unesenih aktivnosti u sustavu.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[700px] rounded-xl border border-border bg-white p-12 shadow-inner">
            <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-slate-700">
               {fullTextChronology}
            </div>
            <div className="mt-12 pt-8 border-t text-center text-[10px] text-muted-foreground uppercase tracking-widest italic">
              Kraj službenog zapisa ljetopisa
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
