import threading
import time
from collections import defaultdict

import schedule

from agent import run_agent_turn
from contants import SOUL
from utils import load_session, save_session

session_locks = defaultdict(threading.Lock)


def setup_heartbeats():
    """Configure recurring agent tasks."""

    def morning_briefing():
        print("\n[heartbeat] morning briefing")
        # Use an isolated session key so cron doesn't pollute main chat
        session_key = "cron:morning-briefing"

        with session_locks[session_key]:
            messages = load_session(session_key)
            messages.append(
                {
                    "role": "user",
                    "content": "Good morning! Check today's date and give me a motivational quote.",
                }
            )

            response_text, messages = run_agent_turn(messages, SOUL)
            save_session(session_key, messages)

        print(f"[bot] {response_text}\n")
        # In production, you'd send this to Telegram/Discord too

    # schedule.every().day.at("07:30").do(morning_briefing)
    schedule.every(1).minutes.do(morning_briefing)

    # Run the scheduler in a background thread
    def scheduler_loop():
        while True:
            schedule.run_pending()
            time.sleep(60)

    threading.Thread(target=scheduler_loop, daemon=True).start()


# Call during startup, before run_polling()
