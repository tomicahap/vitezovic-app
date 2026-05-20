"use client"

import React, { useState, useMemo } from 'react'
import { useActivityLog } from '@/contexts/activity-log-context'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Filter, Calendar, User, Activity, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export function ActivityLogsContent() {
  const { logs, getRecentLogs } = useActivityLog()
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [userFilter, setUserFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [limit, setLimit] = useState(100)

  // Proveri da li korisnik ima pravo pristupa
  if (!user || !['admin', 'moderator'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Pristup odbijen</h3>
          <p className="text-muted-foreground">
            Nemate dozvolu za pregled logova aktivnosti.
          </p>
        </div>
      </div>
    )
  }

  const filteredLogs = useMemo(() => {
    let filtered = getRecentLogs(limit)

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (userFilter !== 'all') {
      filtered = filtered.filter(log => log.userId === userFilter)
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter)
    }

    return filtered
  }, [logs, searchTerm, userFilter, actionFilter, limit, getRecentLogs])

  const uniqueUsers = useMemo(() => {
    const map = new Map()
    logs.forEach(log => {
      if (!map.has(log.userId)) {
        map.set(log.userId, { id: log.userId, name: log.userName })
      }
    })
    return Array.from(map.values())
  }, [logs])
  
  const uniqueActions = useMemo(() => [...new Set(logs.map(log => log.action))], [logs])

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('hr-HR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(timestamp)
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive'
      case 'moderator': return 'default'
      case 'member': return 'secondary'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Nazad
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold">Logovi aktivnosti</h2>
            <p className="text-muted-foreground">
              Pregled svih aktivnosti korisnika u sustavu
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          {logs.length} ukupno logova
        </Badge>
      </div>

      {/* Filteri */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filteri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pretraga</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pretraži logove..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Korisnik</label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Svi korisnici" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi korisnici</SelectItem>
                  {uniqueUsers.map((user, idx) => (
                    <SelectItem key={user.id || `u-${idx}`} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Akcija</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Sve akcije" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve akcije</SelectItem>
                  {uniqueActions.map((action, idx) => (
                    <SelectItem key={action || `a-${idx}`} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Broj logova</label>
              <Select value={limit.toString()} onValueChange={(value) => setLimit(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela logova */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Aktivnosti ({filteredLogs.length})
          </CardTitle>
          <CardDescription>
            Prikaz {filteredLogs.length} od {logs.length} logova
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vrijeme</TableHead>
                  <TableHead>Korisnik</TableHead>
                  <TableHead>Uloga</TableHead>
                  <TableHead>Akcija</TableHead>
                  <TableHead>Detalji</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {formatTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {log.userName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(log.userRole)}>
                        {log.userRole}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate" title={log.details}>
                        {log.details}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {filteredLogs.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center text-muted-foreground">
              <Activity className="mx-auto h-8 w-8 mb-2" />
              <p>Nema logova koji odgovaraju filterima</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}