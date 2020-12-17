class Mail {
    constructor(omegga, config, store) {
        this.omegga = omegga;
        this.config = config;
        this.store = store;
    }

    async initializePlayer(name) {
        if (await this.store.get(name.toLowerCase()) != undefined) return;

        await this.store.set(name.toLowerCase(), []);
    }

    async getOrInitialize(name) {
        var current = await this.store.get(name.toLowerCase());
        if (current != undefined) return current;

        current = [];
        await this.store.set(name.toLowerCase(), current);
        return current;
    }

    sendMessage(target, message) {
        if (this.version == "a5") {
            this.omegga.whisper(target, message);
        } else {
            this.omegga.broadcast(`<b>[${target}]</b> ${message}`);
        }
    }

    async checkUnreads(name) {
        const messages = await this.getOrInitialize(name);
        const unreads = messages.filter((m) => !m.read).length;
        if (unreads == 0) return;
        this.sendMessage(name, `You have <b>${unreads} unread messages</b>. Check your messages with <code>!m:mail</code>.`);
    }

    checkUnreadsAll() {
        this.omegga.getPlayers().forEach(async (p) => {
            await this.checkUnreads(p.name);
        });
    }

    formatSpan(pastTime) {
        const span = Date.now() - pastTime;
        const mins = Math.floor(span / (1000 * 60));
        const hours = Math.floor(span / (1000 * 60 * 60));
        if (hours > 0) return `${hours} hours ago`;
        else return `${mins} minutes ago`;
    }

    async init() {
        this.authorized = this.config.authorized.split(",").map((n) => n.trim().toLowerCase());

        // Initialize everyone, and add the hook for players joining
        this.omegga.getPlayers().forEach(async (p) => await this.initializePlayer(p.name));
        this.omegga.on("join", async (p) => await this.initializePlayer(p.name));

        this.omegga.on("version", (v) => this.version = v);

        this.omegga.on("chatcmd:m:pm", async (sender, target, ...messageList) => {
            // Check authority
            if (!this.config["anyone-can-message"] && !this.authorized.includes(sender.toLowerCase()) && !this.omegga.getPlayer(sender).isHost()) return;

            const targetInStore = await this.store.get(target.toLowerCase());
            if (targetInStore == undefined) {
                this.sendMessage(sender, `<b>${target}</b> is not a valid player. They must have joined the server at least once with the plugin running.`);
                return;
            }

            const messageObject = {
                "message": messageList.join(" "),
                "sender": sender,
                "date": Date.now(),
                "read": false
            };
            targetInStore.push(messageObject);

            await this.store.set(target.toLowerCase(), targetInStore);
            this.sendMessage(sender, `Message sent to <b>${target}</b>.`);

            // todo: check if target is online, if so, notify immediately of a new message
        });

        this.omegga.on("chatcmd:m:mail", async (name) => {
            const messages = await this.getOrInitialize(name);
            const unreads = messages.filter((m) => !m.read).length;
            this.sendMessage(name, `<color="0000ff">You have <b>${unreads} unread messages</b> and ${messages.length} total messages.</color>`);
        
            messages.sort((a, b) => b.date - a.date).forEach((m, i) => {
                this.sendMessage(name, `${i + 1}) ${m.read ? "" : "<i>(Unread)</i> "}<b>Message from ${m.sender}, sent ${this.formatSpan(m.date)}</b>`);
                this.sendMessage(name, m.message);
                m.read = true;
            });

            this.sendMessage(name, `<color="4444ff">Delete a message with <code>!m:del #</code>${this.config["enable-replies"] ? ". Reply to one with <code>!m:reply # text</code>" : ""}.</color>`)

            await this.store.set(name.toLowerCase(), messages);
        });

        this.omegga.on("chatcmd:m:del", async (name, messageIndex) => {
            const messages = (await this.getOrInitialize(name)).sort((a, b) => b.date - a.date);
            if (messageIndex < 1 || messageIndex > messages.length) {
                if (messages.length == 0)
                    this.sendMessage(name, "You have no messages to delete.");
                else if (messages.length == 1)
                    this.sendMessage(name, "You have 1 message to delete, so delete it with <code>!m:del 1</code>.");
                else
                    this.sendMessage(name, `You have ${messages.length} total messages, so enter a number between 1 and ${messages.length} to delete one.`);
                return;
            }

            if (!messages[messageIndex - 1].read) {
                this.sendMessage(name, "That message is still unread. Read it with <code>!m:mail</code> first.");
                return;
            }

            messages.splice(messageIndex - 1, 1);
            await this.store.set(name.toLowerCase(), messages);
            this.sendMessage(name, `Message ${messageIndex} deleted.`);
        });

        this.omegga.on("chatcmd:m:reply", async (name, messageIndex, ...replyList) => {
            if (!this.config["enable-replies"]) return;

            const messages = (await this.getOrInitialize(name)).sort((a, b) => b.date - a.date);
            if (messageIndex < 1 || messageIndex > messages.length) {
                if (messages.length == 0)
                    this.sendMessage(name, "You have no messages to reply to.");
                else if (messages.length == 1)
                    this.sendMessage(name, "You have 1 message to reply to, so reply to it with <code>!m:reply 1 message here</code>.");
                else
                    this.sendMessage(name, `You have ${messages.length} total messages, so enter a number between 1 and ${messages.length} to reply to one.`);
                return;
            }

            if (!messages[messageIndex - 1].read) {
                this.sendMessage(name, "That message is still unread. Read it with <code>!m:mail</code> first.");
                return;
            }

            const reply = replyList.join(" ");

            // Delete the message we're replying to
            const oldMessage = messages.splice(messageIndex - 1, 1)[0];

            // Update the replier's messages
            await this.store.set(name, messages);

            // Create the new message
            const newMessage = {"message": reply, "sender": name, "date": Date.now(), "read": false};
            
            const senderMessages = await this.getOrInitialize(oldMessage.sender.toLowerCase());
            senderMessages.push(newMessage);
            await this.store.set(oldMessage.sender.toLowerCase(), senderMessages);
            this.sendMessage(name, `Replied to <b>${oldMessage.sender}</b>.`);
        });

        this.omegga.on("chatcmd:m:reset", async (name, confirm) => {
            if (!this.omegga.getPlayer(name).isHost()) return;
            if (confirm != "yes") {
                await this.sendMessage(name, "Are you sure? You must pass <code>yes</code> as an argument to reset.");
                return;
            }
            await this.store.wipe();
            await this.sendMessage(name, "Message store reset.");
        });

        // Start the interval
        if (this.config["unread-notification-interval"] > 0) {
            this.notificationInterval = setInterval(async () => {
                this.checkUnreadsAll();
            }, this.config["unread-notification-interval"] * 1000);
            this.checkUnreadsAll();
        }
    }

    async stop() {

    }
}

module.exports = Mail;