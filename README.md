# omegga-mail

Offline mail system for Omegga. Send messages to players when they're offline, and they'll be notified when
they come online again. Great for moderation when players aren't online.

## Installation

`cd plugins`

`git clone git://github.com/voximity/omegga-mail.git`

## Usage

After configuration, the commands are as follows:

- `!m:pm <user> <message>` - When authorized, send the message to the user.
- `!m:mail` - Check your mail.
- `!m:del #` - Delete a message with the corresponding #.
- `!m:reply # <message>` - Reply to a message with the corresponding #. Only works if `enable-replies` is on.
- `!m:reset <confirmation>` - As host, you can reset ALL messages at any time. Simply run `!m:reset yes`.