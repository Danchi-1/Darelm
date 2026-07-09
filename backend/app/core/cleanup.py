import logging
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.db.session import SessionLocal
from app.db.models import Dataset
from app.core.oss import oss_manager

logger = logging.getLogger(__name__)

def cleanup_inactive_datasets():
    """
    Deletes datasets that haven't been accessed in the last 3 days.
    """
    logger.info("Starting cleanup of inactive datasets...")
    db = SessionLocal()
    try:
        threshold_date = datetime.now(timezone.utc) - timedelta(days=3)
        
        # Find datasets where last_accessed_at is older than 3 days
        inactive_datasets = db.query(Dataset).filter(Dataset.last_accessed_at < threshold_date).all()
        
        if not inactive_datasets:
            logger.info("No inactive datasets found for cleanup.")
            return

        for dataset in inactive_datasets:
            logger.info(f"Deleting inactive dataset: {dataset.id} ({dataset.name})")
            try:
                # Delete from OSS
                if dataset.storage_url:
                    oss_manager.delete_file(dataset.storage_url)
                    oss_manager.delete_file(f"{dataset.storage_url}.gz")
                
                # Delete from DB
                db.delete(dataset)
            except Exception as e:
                logger.error(f"Failed to delete dataset {dataset.id}: {e}")
        
        db.commit()
        logger.info(f"Successfully cleaned up {len(inactive_datasets)} inactive datasets.")
    except Exception as e:
        logger.error(f"Error during cleanup_inactive_datasets: {e}")
        db.rollback()
    finally:
        db.close()

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Run every day at 3:00 AM UTC
    scheduler.add_job(cleanup_inactive_datasets, CronTrigger(hour=3, minute=0))
    scheduler.start()
    logger.info("Started BackgroundScheduler for dataset cleanup.")
    return scheduler
