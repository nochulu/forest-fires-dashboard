const EventBus = {
    listeners: {},

    on(event, cb) {
        (this.listeners[event] ??= []).push(cb);
    },

    emit(event, data) {
        (this.listeners[event] ?? []).forEach(cb => cb(data));
    },

    off(event, cb) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(l => l !== cb);
    }
};