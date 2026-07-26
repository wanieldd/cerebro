"""Scheduled task scheduler using APScheduler."""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import logging
import database as db

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

async def execute_scheduled_task(task_id: str):
    """Execute a scheduled task: send the prompt to the LLM and store result."""
    from agent import stream_agent
    conv = await db.create_conversation(title=f"[Scheduled] {task_id}")
    logger.info(f"Running scheduled task: {task_id}")

def start_scheduler():
    """Start the APScheduler background scheduler."""
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started")

async def load_tasks():
    """Load all enabled tasks from DB into the scheduler."""
    tasks = await db.get_all_scheduled_tasks()
    for task in tasks:
        if task.get("enabled", 1):
            schedule_task(task)

def schedule_task(task: dict):
    """Add a single task to the scheduler."""
    try:
        trigger = CronTrigger.from_crontab(task["schedule"])
        scheduler.add_job(
            execute_scheduled_task,
            trigger=trigger,
            args=[task["id"]],
            id=task["id"],
            replace_existing=True,
        )
    except Exception as e:
        logger.error(f"Failed to schedule task {task['id']}: {e}")

def remove_scheduled_task(task_id: str):
    """Remove a task from the scheduler."""
    try:
        scheduler.remove_job(task_id)
    except:
        pass
