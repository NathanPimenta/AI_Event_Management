"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, ClipboardList, PlusCircle } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function DashboardTasks() {
  const { user } = useAuth()
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [clubs, setClubs] = useState<any[]>([])
  const [selectedClub, setSelectedClub] = useState("")
  const [clubMembers, setClubMembers] = useState<any[]>([])
  const [clubEvents, setClubEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskDescription, setNewTaskDescription] = useState("")
  const [newTaskDueDate, setNewTaskDueDate] = useState("")
  const [newTaskEvent, setNewTaskEvent] = useState("")
  const [newTaskAssignee, setNewTaskAssignee] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState("medium")

  useEffect(() => {
    async function fetchTasks() {
      if (!user?.id) return
      
      try {
        const response = await fetch(`/api/tasks?userId=${user.id}`)
        if (response.ok) {
          const data = await response.json()
          setTasks(data)
        }
      } catch (error) {
        console.error("Failed to fetch tasks:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [user?.id])

  // Fetch user's clubs when dialog opens
  useEffect(() => {
    async function fetchClubs() {
      if (!user?.id || !createDialogOpen) return
      
      try {
        const response = await fetch(`/api/clubs?userId=${user.id}`)
        if (response.ok) {
          const data = await response.json()
          setClubs(data)
        }
      } catch (error) {
        console.error("Failed to fetch clubs:", error)
      }
    }

    fetchClubs()
  }, [user?.id, createDialogOpen])

  // Fetch club members and events when a club is selected
  useEffect(() => {
    async function fetchClubData() {
      if (!selectedClub) {
        setClubMembers([])
        setClubEvents([])
        return
      }
      
      try {
        const [clubRes, eventsRes] = await Promise.all([
          fetch(`/api/clubs/${selectedClub}`),
          fetch(`/api/events?clubId=${selectedClub}`)
        ])

        if (clubRes.ok) {
          const clubData = await clubRes.json()
          setClubMembers(clubData.members || [])
        }
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json()
          setClubEvents(eventsData)
        }
      } catch (error) {
        console.error("Failed to fetch club data:", error)
      }
    }

    fetchClubData()
  }, [selectedClub])

  const filteredTasks = tasks.filter((task) => {
    if (filter === "all") return true
    if (filter === "pending") return task.status === "pending"
    if (filter === "completed") return task.status === "completed"
    if (filter === "high") return task.priority === "high"
    return true
  })

  const toggleTaskStatus = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const newStatus = task.status === "pending" ? "completed" : "pending"
    
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        setTasks(
          tasks.map((t) => {
            if (t.id === taskId) {
              return { ...t, status: newStatus }
            }
            return t
          }),
        )
      }
    } catch (error) {
      console.error("Failed to update task status:", error)
    }
  }

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !newTaskDueDate || !newTaskAssignee || !selectedClub) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Club, Title, Due Date, and Assignee)",
        variant: "destructive",
      })
      return
    }

    setCreating(true)

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: selectedClub,
          eventId: newTaskEvent && newTaskEvent !== 'none' ? newTaskEvent : null,
          title: newTaskTitle,
          description: newTaskDescription,
          dueDate: newTaskDueDate,
          assignedTo: newTaskAssignee,
          priority: newTaskPriority,
          status: 'pending',
          createdBy: user?.id || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create task')
      }

      // Refresh tasks list
      const tasksRes = await fetch(`/api/tasks?userId=${user?.id}`)
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setTasks(tasksData)
      }

      // Reset form
      setNewTaskTitle("")
      setNewTaskDescription("")
      setNewTaskDueDate("")
      setNewTaskEvent("")
      setNewTaskAssignee("")
      setNewTaskPriority("medium")
      setSelectedClub("")

      setCreateDialogOpen(false)

      toast({
        title: "Task created",
        description: "The task has been created successfully",
      })
    } catch (error: any) {
      console.error("Failed to create task:", error)
      toast({
        title: "Task creation failed",
        description: error.message || "There was an error creating the task",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Your Tasks</h2>
        <div className="flex gap-2">
          <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            Create Task
          </Button>
          <div className="flex gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
              All
            </Button>
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
            >
              Pending
            </Button>
            <Button
              variant={filter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("completed")}
            >
              Completed
            </Button>
            <Button variant={filter === "high" ? "default" : "outline"} size="sm" onClick={() => setFilter("high")}>
              High Priority
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Create a new task for a club. Select a club first.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="club">Club *</Label>
              <Select value={selectedClub} onValueChange={setSelectedClub}>
                <SelectTrigger id="club">
                  <SelectValue placeholder="Select a club" />
                </SelectTrigger>
                <SelectContent>
                  {clubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClub && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter task title"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter task description"
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event">Related Event (Optional)</Label>
                  <Select value={newTaskEvent} onValueChange={setNewTaskEvent}>
                    <SelectTrigger id="event">
                      <SelectValue placeholder="Select an event or leave empty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {clubEvents.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignee">Assign To *</Label>
                  <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                    <SelectTrigger id="assignee">
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {clubMembers.map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                    <SelectTrigger id="priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={creating || !selectedClub}>
              {creating ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No tasks found</p>
            <p className="text-muted-foreground text-center mb-4">
              {filter !== "all" ? `You don't have any ${filter} tasks` : "You haven't been assigned any tasks yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <Card key={task.id} className={task.status === "completed" ? "opacity-70" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={`task-${task.id}`}
                    checked={task.status === "completed"}
                    onCheckedChange={() => toggleTaskStatus(task.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <CardTitle
                        className={`text-lg ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}
                      >
                        {task.title}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge
                          variant={
                            task.priority === "high"
                              ? "destructive"
                              : task.priority === "medium"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {task.priority}
                        </Badge>
                        <Badge variant={task.status === "completed" ? "outline" : "secondary"}>{task.status}</Badge>
                      </div>
                    </div>
                    <CardDescription>
                      {task.club} • {task.event}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-2">{task.description}</p>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Link href={`/tasks/${task.id}`}>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

