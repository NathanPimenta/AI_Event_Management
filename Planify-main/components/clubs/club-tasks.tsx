"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PlusCircle, Calendar, ClipboardList, Search, User } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
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

interface ClubTasksProps {
  clubId: string
}

export default function ClubTasks({ clubId }: ClubTasksProps) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskDescription, setNewTaskDescription] = useState("")
  const [newTaskDueDate, setNewTaskDueDate] = useState("")
  const [newTaskEvent, setNewTaskEvent] = useState("")
  const [newTaskAssignee, setNewTaskAssignee] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState("medium")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [tasksRes, clubRes, eventsRes] = await Promise.all([
          fetch(`/api/tasks?clubId=${clubId}`),
          fetch(`/api/clubs/${clubId}`),
          fetch(`/api/events?clubId=${clubId}`)
        ])

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json()
          setTasks(tasksData)
        }
        if (clubRes.ok) {
          const clubData = await clubRes.json()
          setMembers(clubData.members || [])
        }
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json()
          setEvents(eventsData)
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
        toast({
          title: "Error",
          description: "Failed to load tasks data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [clubId])

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignedToName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && task.status === "pending") ||
      (filter === "completed" && task.status === "completed") ||
      (filter === "high" && task.priority === "high")

    return matchesSearch && matchesFilter
  })

  const toggleTaskStatus = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId)
      if (!task) return

      const newStatus = task.status === "pending" ? "completed" : "pending"

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) throw new Error('Failed to update task')

      setTasks(
        tasks.map((t) => {
          if (t.id === taskId) {
            return { ...t, status: newStatus }
          }
          return t
        }),
      )

      toast({
        title: "Task updated",
        description: `Task marked as ${newStatus}`,
      })
    } catch (error) {
      console.error("Failed to update task:", error)
      toast({
        title: "Update failed",
        description: "Failed to update task status",
        variant: "destructive",
      })
    }
  }

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !newTaskDueDate || !newTaskAssignee) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Title, Due Date, and Assignee)",
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
          clubId,
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

      const newTask = await response.json()
      
      // Refresh tasks list
      const tasksRes = await fetch(`/api/tasks?clubId=${clubId}`)
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

      setCreateDialogOpen(false)

      toast({
        title: "Task created",
        description: "The task has been created successfully",
      })
    } catch (error) {
      console.error("Failed to create task:", error)
      toast({
        title: "Task creation failed",
        description: "There was an error creating the task. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Club Tasks</CardTitle>
            <CardDescription>Manage and assign tasks to club members</CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>Assign a task to a club member</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title</Label>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                    />
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event">Related Event (Optional)</Label>
                  <Select value={newTaskEvent} onValueChange={setNewTaskEvent}>
                    <SelectTrigger id="event">
                      <SelectValue placeholder="Select event (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {events.map((event: any) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title || event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignee">Assignee</Label>
                  <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                    <SelectTrigger id="assignee">
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">No members found</div>
                      ) : (
                        members.map((member: any) => (
                          <SelectItem key={member.userId || member.id} value={member.userId || member.id}>
                            {member.name || member.email}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTask}
                  disabled={creating || !newTaskTitle.trim() || !newTaskDueDate || !newTaskAssignee}
                >
                  {creating ? "Creating..." : "Create Task"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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

          {filteredTasks.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No tasks found</p>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "No tasks match your search criteria" : "You haven't created any tasks yet"}
              </p>
              <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
                <PlusCircle className="h-4 w-4" />
                Create Task
              </Button>
            </div>
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
                          {task.eventId ? `Event ID: ${task.eventId}` : 'General club task'}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-2">{task.description || 'No description'}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Assigned to: {task.assignedToName || 'Unassigned'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

