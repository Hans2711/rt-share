# 🕐 File Transfer Timeout Implementation

## Overview
Added 2-minute timeout monitoring for both sending and receiving file transfers to detect stalled connections and alert users when transfers fail.

---

## 🎯 Problem Solved

**Before:**
- File transfers could stall indefinitely if connection becomes unstable
- No way to know if a transfer has failed
- Users would wait endlessly for files that would never complete
- Memory/resources held by incomplete transfers

**After:**
- ✅ 2-minute timeout per file transfer (send & receive)
- ✅ Automatic detection of stalled transfers
- ✅ Clear error messages to users
- ✅ Automatic cleanup of failed transfers
- ✅ Timeout resets on each chunk successfully sent/received

---

## 🔧 Implementation Details

### Timeout Tracking References
```typescript
const fileReceiveTimeouts = useRef<Record<string, number>>({});
const fileSendTimeouts = useRef<Record<string, number>>({});
```

### Receiving Files

**When file-meta is received (transfer starts):**
- Start 2-minute timeout
- If timeout triggers → Clean up partial transfer, show error alert

**When binary chunk is received:**
- Reset 2-minute timeout (transfer is progressing)
- Prevents timeout for large files that take longer than 2 minutes

**When file-end is received (transfer completes):**
- Clear timeout
- Normal completion

**Error Message:**
```
File transfer from {userId} failed: Connection timeout (no data received for 2 minutes)
```

### Sending Files

**When starting to send:**
- Start 2-minute timeout monitoring

**On each chunk successfully sent:**
- Reset 2-minute timeout
- Keeps transfer alive as long as progress is being made

**On completion or error:**
- Clear timeout

**Error Message:**
```
File transfer to {userId} failed: Connection timeout (no data sent for 2 minutes)
```

---

## 📊 Timeout Behavior

### For Fast Connections:
```
Start → Send/Receive chunks every few ms → Complete
        (timeout never triggers)
```

### For Slow but Working Connections:
```
Start → Chunk 1 (reset) → Chunk 2 (reset) → ... → Complete
        (timeout resets frequently, never triggers)
```

### For Stalled Connections:
```
Start → Chunk 1 → Chunk 2 → [No activity for 2 min] → TIMEOUT!
        ↓
        Alert user + cleanup
```

---

## 🧹 Cleanup Implementation

### When User Disconnects:
```typescript
if (fileReceiveTimeouts.current[userID]) {
    clearTimeout(fileReceiveTimeouts.current[userID]);
    delete fileReceiveTimeouts.current[userID];
}
if (fileSendTimeouts.current[userID]) {
    clearTimeout(fileSendTimeouts.current[userID]);
    delete fileSendTimeouts.current[userID];
}
```

### On Component Unmount:
```typescript
Object.values(fileReceiveTimeouts.current).forEach(clearTimeout);
Object.values(fileSendTimeouts.current).forEach(clearTimeout);
```

---

## ⏱️ Why 2 Minutes?

**Rationale:**
- ✅ Long enough for slow connections (3G, poor WiFi)
- ✅ Long enough for large chunks to buffer through
- ✅ Short enough to detect genuine failures
- ✅ User won't wait too long before getting feedback

**Chunk sizes:**
- Default: 16 KiB per chunk
- On 100 Kbps connection: ~1.3 seconds per chunk
- 2 minutes = 92 chunks at slowest reasonable speed

---

## 🎯 Edge Cases Handled

### ✅ Large Files (> 2 minutes to transfer)
**Solution:** Timeout resets on each chunk
- 1 GB file taking 10 minutes: No timeout (continuous progress)

### ✅ Slow but Working Connection
**Solution:** Timeout resets as long as chunks arrive
- Consistently receiving chunks every 30s: No timeout

### ✅ User Disconnects Mid-Transfer
**Solution:** Timeout cleared, resources released
- No orphaned timeouts or memory leaks

### ✅ Multiple Simultaneous Transfers
**Solution:** Per-user timeout tracking
- Each transfer has independent timeout

### ✅ Network Hiccup < 2 Minutes
**Solution:** Timeout resets when transfer resumes
- Brief WiFi disconnection: Transfer continues

### ✅ Complete Stall (connection dead)
**Solution:** Timeout triggers, user alerted
- DataChannel dead but not closed: Timeout detects it

---

## 🔍 Debugging

### Check for Timeout Issues:
```javascript
// Console logs will show:
"File receive timeout for {userId} - no chunks received in 2 minutes"
"File send timeout for {userId} - no chunks sent in 2 minutes"
```

### Common Scenarios:

**Timeout triggers too early:**
- Connection might be < 13 Kbps (extremely slow)
- Consider increasing timeout for specific networks

**Timeout never triggers:**
- DataChannel is receiving keep-alive signals
- But actual file chunks aren't being processed
- Check datachannel message handling

---

## 📈 Performance Impact

**Memory:**
- +8 bytes per active transfer (timeout ID)
- Negligible impact

**CPU:**
- Timeout checks: O(1) per chunk
- Minimal overhead

**User Experience:**
- ✅ Clear feedback when transfers fail
- ✅ No indefinite waiting
- ✅ Resources freed automatically

---

## 🛠️ Configuration

### To Adjust Timeout Duration:
```typescript
// Change 120000 (2 minutes) to desired milliseconds
// Example: 3 minutes = 180000
window.setTimeout(() => {
    // timeout logic
}, 120000); // ← Change this value
```

### Recommended Values:
- **Fast networks:** 60000 (1 minute)
- **General use:** 120000 (2 minutes) ← Current
- **Very slow networks:** 300000 (5 minutes)

---

## ✅ Testing Recommendations

### Test Scenarios:
1. ✅ Normal transfer (should complete without timeout)
2. ✅ Simulate slow connection (should work if < 2 min per chunk)
3. ✅ Kill datachannel mid-transfer (should timeout after 2 min)
4. ✅ Large file transfer > 2 min total (should work, timeout resets)
5. ✅ Multiple simultaneous transfers (each tracks independently)
6. ✅ User disconnects during transfer (cleanup should occur)

### How to Test Timeout:
```javascript
// In browser console during transfer:
// Pause the datachannel to simulate stall
dataChannels.current[userId].close();
// Wait 2 minutes → Should see timeout error
```

---

## 🔐 Security Considerations

**Timeouts Help Prevent:**
- ✅ Resource exhaustion attacks (incomplete transfers using memory)
- ✅ Zombie connections consuming resources
- ✅ User confusion about transfer status

**No Security Risks Introduced:**
- Timeouts are client-side only
- No new attack vectors
- Defensive programming practice

---

## 📝 Summary

**What Was Added:**
- 2-minute inactivity timeout for file receives
- 2-minute inactivity timeout for file sends  
- Automatic timeout reset on progress
- Error alerts on timeout
- Complete cleanup of failed transfers

**User Benefits:**
- Know when transfers fail
- Don't wait indefinitely
- Clear error messages
- Automatic recovery (can retry)

**Developer Benefits:**
- No memory leaks from stalled transfers
- Better resource management
- Easier debugging with timeout logs
- Predictable failure behavior
