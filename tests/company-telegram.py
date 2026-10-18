"""Local-only authorization/append test: never talks to Telegram."""
import importlib.util
import json
import tempfile
from pathlib import Path
spec = importlib.util.spec_from_file_location('company_hook', Path(__file__).resolve().parents[1] / 'ops/company/telegram_hook.py')
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)
with tempfile.TemporaryDirectory() as d:
    file = Path(d) / 'inbox'
    def message(text, sender=10, chat=20):
        return {'text': text, 'from': {'id': sender}, 'chat': {'id': chat}, 'message_id': 30}
    assert not hook.capture(message('STOP existing-governor-batch'), file, 10, 20)
    assert hook.capture(message('COMPANY PAUSE', sender=99), file, 10, 20)
    assert not file.exists()
    assert hook.capture(message('COMPANY RESUME', chat=99), file, 10, 20)
    assert not file.exists()
    assert hook.capture(message('COMPANY ADMISSION off'), file, 10, 20)
    assert hook.capture(message('TOLLEY ROLLBACK guide.animate'), file, 10, 20)
    rows = [json.loads(line) for line in file.read_text().splitlines()]
    assert [row['command'] for row in rows] == ['ADMISSION', 'ROLLBACK']
    assert rows[0]['argument'] == 'off'
    assert file.stat().st_mode & 0o777 == 0o600
print('PASS Telegram owner, chat, command separation, durable capture and file permissions')
