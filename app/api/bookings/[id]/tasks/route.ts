import { NextRequest, NextResponse } from 'next/server'
import { toggleTask, reconcileTasks, loadBookingWithAllData } from '@/lib/modules/bookings/booking.service'
import { getAccessContext } from '@/lib/access'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)
    if (!currentStaff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, taskId } = await request.json()

    switch (action) {
      case 'toggle': {
        const { tasks } = await loadBookingWithAllData(id)
        const task = tasks.find(t => t.id === taskId)
        if (!task) {
          return NextResponse.json(
            { error: 'Task not found' },
            { status: 404 }
          )
        }

        await toggleTask(task, currentStaff)
        return NextResponse.json({ success: true, message: 'Task updated' })
      }

      case 'reconcile': {
        const { booking, flights, accommodations, transfers, payments, tasks } = await loadBookingWithAllData(id)
        if (!booking) {
          return NextResponse.json(
            { error: 'Booking not found' },
            { status: 404 }
          )
        }

        const reconciledTasks = await reconcileTasks(booking, flights, accommodations, transfers, payments, tasks)
        return NextResponse.json({ data: reconciledTasks })
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}
