"""Called by the EXISTING intake listener; never polls Telegram itself."""
import json
import os
import re
from pathlib import Path

COMMAND = re.compile(r"^\s*(?:COMPANY|TOLLEY)\s+(STATUS|PAUSE|RESUME|STOP|APPROVE|REJECT|ROLLBACK|ADMISSION)\b\s*(.*?)\s*$", re.I)

def capture(message, inbox, owner_id, chat_id):
    text = message.get("text", "")
    match = COMMAND.match(text)
    if not match:
        return False
    if str(message.get("from", {}).get("id")) != str(owner_id) or str(message.get("chat", {}).get("id")) != str(chat_id):
        return True
    row = {"updateId": str(message["message_id"]), "senderId": str(owner_id), "chatId": str(chat_id), "command": match[1].upper(), "argument": match[2][:150]}
    path = Path(inbox)
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
    with os.fdopen(fd, "a") as f:
        f.write(json.dumps(row) + "\n")
        f.flush()
        os.fsync(f.fileno())
    return True
