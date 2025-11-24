import io from 'socket.io-client';
export function connectWebSocket() {
    return io('http://localhost:3000');
}