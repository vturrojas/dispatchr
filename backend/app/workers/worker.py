from rq import Worker
from app.workers.queue import redis_conn

if __name__ == "__main__":
    w = Worker(["dispatchr"], connection=redis_conn)
    w.work(with_scheduler=False)
