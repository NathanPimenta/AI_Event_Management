'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Round {
  id: string;
  round_number: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  requirements: string;
  evaluation_criteria: string;
  created_at: string;
}

interface Team {
  id: string;
  name: string;
  team_lead: string;
  status: 'active' | 'advanced' | 'eliminated' | 'withdrawn';
  member_count: number;
  submission_count: number;
  score?: number;
  reviewed_by?: string;
  reviewed_at?: string;
}

interface RoundManagementProps {
  eventId: string;
  isOrganizer?: boolean;
}

export function RoundManagement({ eventId, isOrganizer = false }: RoundManagementProps) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateRound, setShowCreateRound] = useState(false);
  const [showAdvanceTeam, setShowAdvanceTeam] = useState(false);
  const [showEliminateTeam, setShowEliminateTeam] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Form states
  const [newRound, setNewRound] = useState({
    title: '',
    description: '',
    round_number: 1,
    start_date: '',
    end_date: '',
    requirements: '',
    evaluation_criteria: '',
  });

  const [advanceReason, setAdvanceReason] = useState('');
  const [eliminateFeedback, setEliminateFeedback] = useState('');

  // Fetch rounds on mount
  useEffect(() => {
    fetchRounds();
  }, [eventId]);

  // Fetch teams when round is selected
  useEffect(() => {
    if (selectedRound) {
      fetchTeams(selectedRound.id);
    }
  }, [selectedRound]);

  const fetchRounds = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}/rounds`);
      if (!response.ok) throw new Error('Failed to fetch rounds');
      const data = await response.json();
      setRounds(Array.isArray(data) ? data : data.rounds || []);
      if (data.length > 0) {
        setSelectedRound(data[0]);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load rounds',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async (roundId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}/rounds/${roundId}/teams`);
      if (!response.ok) throw new Error('Failed to fetch teams');
      const data = await response.json();
      setTeams(Array.isArray(data) ? data : data.teams || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load teams',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRound = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRound),
      });

      if (!response.ok) throw new Error('Failed to create round');

      toast({
        title: 'Success',
        description: 'Round created successfully',
      });

      setShowCreateRound(false);
      setNewRound({
        title: '',
        description: '',
        round_number: 1,
        start_date: '',
        end_date: '',
        requirements: '',
        evaluation_criteria: '',
      });
      fetchRounds();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create round',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceTeam = async () => {
    if (!selectedTeam || !selectedRound) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/events/${eventId}/rounds/${selectedRound.id}/advance-team`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_id: selectedTeam.id,
            reason: advanceReason,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to advance team');

      toast({
        title: 'Success',
        description: 'Team advanced to next round. Email notification sent.',
      });

      setShowAdvanceTeam(false);
      setAdvanceReason('');
      fetchTeams(selectedRound.id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to advance team',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEliminateTeam = async () => {
    if (!selectedTeam || !selectedRound) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/events/${eventId}/rounds/${selectedRound.id}/eliminate-team`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_id: selectedTeam.id,
            feedback: eliminateFeedback,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to eliminate team');

      toast({
        title: 'Success',
        description: 'Team eliminated. Feedback email sent.',
      });

      setShowEliminateTeam(false);
      setEliminateFeedback('');
      fetchTeams(selectedRound.id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to eliminate team',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-700';
      case 'advanced':
        return 'bg-green-100 text-green-700';
      case 'eliminated':
        return 'bg-red-100 text-red-700';
      case 'withdrawn':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading && rounds.length === 0) {
    return <div className="p-4 text-center">Loading rounds...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Rounds List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Event Rounds</CardTitle>
            <CardDescription>Manage rounds for this event</CardDescription>
          </div>
          {isOrganizer && (
            <Button onClick={() => setShowCreateRound(true)} size="sm">
              Create Round
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {rounds.length === 0 ? (
            <p className="text-sm text-gray-500">No rounds created yet</p>
          ) : (
            <Tabs
              value={selectedRound?.id || ''}
              onValueChange={(roundId) => {
                const round = rounds.find((r) => r.id === roundId);
                setSelectedRound(round || null);
              }}
              className="w-full"
            >
              <TabsList className="grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(rounds.length, 4)}, 1fr)` }}>
                {rounds.map((round) => (
                  <TabsTrigger key={round.id} value={round.id} className="text-xs">
                    Round {round.round_number}
                  </TabsTrigger>
                ))}
              </TabsList>

              {rounds.map((round) => (
                <TabsContent key={round.id} value={round.id} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Title</p>
                      <p className="text-lg font-semibold">{round.title}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Duration</p>
                      <p className="text-sm">
                        {new Date(round.start_date).toLocaleDateString()} -{' '}
                        {new Date(round.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-600">Description</p>
                      <p className="text-sm text-gray-700">{round.description}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-600">Evaluation Criteria</p>
                      <p className="text-sm text-gray-700">{round.evaluation_criteria}</p>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Teams in Selected Round */}
      {selectedRound && (
        <Card>
          <CardHeader>
            <CardTitle>Teams in Round {selectedRound.round_number}</CardTitle>
            <CardDescription>Manage team progression and submissions</CardDescription>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <p className="text-sm text-gray-500">No teams in this round</p>
            ) : (
              <div className="space-y-3">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{team.name}</p>
                      <p className="text-sm text-gray-600">Lead: {team.team_lead}</p>
                      <div className="mt-2 flex gap-2">
                        <span className="text-xs text-gray-500">Members: {team.member_count}</span>
                        <span className="text-xs text-gray-500">
                          Submissions: {team.submission_count}
                        </span>
                        {team.score && (
                          <span className="text-xs text-gray-500">Score: {team.score}/100</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(team.status)}>
                        {team.status.charAt(0).toUpperCase() + team.status.slice(1)}
                      </Badge>

                      {isOrganizer && team.status === 'active' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setSelectedTeam(team);
                              setShowAdvanceTeam(true);
                            }}
                          >
                            Advance
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedTeam(team);
                              setShowEliminateTeam(true);
                            }}
                          >
                            Eliminate
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Round Dialog */}
      <Dialog open={showCreateRound} onOpenChange={setShowCreateRound}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Round</DialogTitle>
            <DialogDescription>Add a new round to this event</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Round Number</label>
                <Input
                  type="number"
                  value={newRound.round_number}
                  onChange={(e) =>
                    setNewRound({ ...newRound, round_number: parseInt(e.target.value) })
                  }
                  min="1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={newRound.title}
                  onChange={(e) => setNewRound({ ...newRound, title: e.target.value })}
                  placeholder="e.g., Initial Screening"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newRound.description}
                onChange={(e) => setNewRound({ ...newRound, description: e.target.value })}
                placeholder="Round description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="datetime-local"
                  value={newRound.start_date}
                  onChange={(e) => setNewRound({ ...newRound, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="datetime-local"
                  value={newRound.end_date}
                  onChange={(e) => setNewRound({ ...newRound, end_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Requirements</label>
              <Textarea
                value={newRound.requirements}
                onChange={(e) => setNewRound({ ...newRound, requirements: e.target.value })}
                placeholder="What teams need to submit or complete"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Evaluation Criteria</label>
              <Textarea
                value={newRound.evaluation_criteria}
                onChange={(e) =>
                  setNewRound({ ...newRound, evaluation_criteria: e.target.value })
                }
                placeholder="How judges will evaluate submissions"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateRound(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRound} disabled={loading}>
                {loading ? 'Creating...' : 'Create Round'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advance Team Dialog */}
      <Dialog open={showAdvanceTeam} onOpenChange={setShowAdvanceTeam}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advance Team to Next Round</DialogTitle>
            <DialogDescription>
              {selectedTeam?.name} will be notified via email
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Advancement Reason</label>
              <Textarea
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
                placeholder="Why is this team advancing?"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdvanceTeam(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdvanceTeam} disabled={loading}>
                {loading ? 'Advancing...' : 'Advance Team'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Eliminate Team Dialog */}
      <Dialog open={showEliminateTeam} onOpenChange={setShowEliminateTeam}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminate Team</DialogTitle>
            <DialogDescription>
              {selectedTeam?.name} will receive feedback via email
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Elimination Feedback</label>
              <Textarea
                value={eliminateFeedback}
                onChange={(e) => setEliminateFeedback(e.target.value)}
                placeholder="Provide constructive feedback for the team"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEliminateTeam(false)}>
                Cancel
              </Button>
              <Button onClick={handleEliminateTeam} variant="destructive" disabled={loading}>
                {loading ? 'Eliminating...' : 'Eliminate Team'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
