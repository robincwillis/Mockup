#!/bin/bash
# schedule-wake.sh
# Sets a repeating hardware wake alarm via pmset.
# Runs at boot via LaunchDaemon so the schedule survives reboots.
# pmset wake schedules can be cleared by OS updates or power events,
# so re-applying at boot keeps things reliable.

WAKE_TIME="05:00:00"
DAYS="MTWRFSU"  # Mon-Sun (all days)

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [wake-scheduler] $*" | tee -a /var/log/macbook-wake.log
}

log "Setting repeating wake schedule: $DAYS at $WAKE_TIME"

# wakeorpoweron: wake if sleeping, power on if off
pmset repeat wakeorpoweron "$DAYS" "$WAKE_TIME"

if [ $? -eq 0 ]; then
    log "Wake schedule set successfully."
    pmset -g sched | tee -a /var/log/macbook-wake.log
else
    log "ERROR: Failed to set wake schedule."
    exit 1
fi
