import { joinRoom, selfId } from 'trystero';

let room;
let sendAction;
const peers = new Set();

export const initNetwork = (roomId, onDataCallback, onStatusChange = () => {}) => {
    const config = { appId: 'bar-link-v1' };
    try {
        room = joinRoom(config, roomId);
    } catch (e) {
        onStatusChange({ type: 'error', error: e });
        throw e;
    }

    peers.clear();
    onStatusChange({ type: 'connected', peers: peers.size });

    const [send, get] = room.makeAction('order');
    sendAction = send;

    const reportPeers = () => onStatusChange({ type: 'peers', peers: peers.size });

    get((data, peerId) => {
        if (peerId) {
            peers.add(peerId);
            reportPeers();
        }
        onDataCallback(data, peerId);
    });

    room.onPeerJoin(peerId => {
        peers.add(peerId);
        onStatusChange({ type: 'join', peerId, peers: peers.size });
    });
    room.onPeerLeave(peerId => {
        peers.delete(peerId);
        onStatusChange({ type: 'leave', peerId, peers: peers.size });
    });
    
    return room;
};

export const broadcast = (payload, targetId) => {
    if (!sendAction) {
        console.warn('No peer connection; payload not sent');
        return false;
    }
    if (!targetId && peers.size === 0) {
        console.warn('No peers to receive payload');
        return false;
    }
    sendAction(payload, targetId);
    return true;
};

export const getPeerCount = () => peers.size;
export { selfId };
