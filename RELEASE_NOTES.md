# Release Notes - Mission System, Leaderboard & Real-Time Map Sync

**Commit:** `91def5e`  
**Branch:** master  
**Date:** May 3, 2026

---

## 🎯 Frontend Summary - What Was Implemented

### 1. **Mission System** (`src/lib/missions.ts`)

- ✅ Daily & Weekly mission pools with 5 missions each
- ✅ Mission caching with AsyncStorage
- ✅ Auto-reset: Daily missions reset at **midnight**, Weekly at **next Monday**
- ✅ Progress tracking: Current captures vs. target (e.g., "3/5 cardboard captured")
- ✅ Mission claiming: Users claim XP reward after completing mission
- ✅ XP multipliers: 100 base XP + category-specific bonuses

### 2. **Mission UI Components**

- ✅ **MissionsScreen.tsx**: Native mission cards with modals for "Show more"
- ✅ **Missions.tsx (Web)**: Web version with expand/collapse sections
- ✅ **Progress Bars**:
  - White background (#f8fafc)
  - Green fill for Daily missions (#10b981)
  - Purple fill for Weekly missions (#c084fc)
  - Safe percent display (0%-100%, never NaN%)
- ✅ **Claim Button**: Highlighted when mission complete, awards XP on tap
- ✅ **Top-3 Leaderboard Display**: Shows global rankings on missions page

### 3. **Leaderboard & Ranking System** (`src/lib/trashStats.ts`)

- ✅ **Static NPC Players**:
  - Erina: 289,200 EcoXP
  - Art: 253,000 EcoXP
  - Kenan: 250,000 EcoXP
- ✅ **Dynamic Ranking Logic**:
  - Fetches real users from Supabase
  - Merges real users + NPCs
  - Sorts by EcoXP descending
  - Real users can push NPCs down in ranking
- ✅ **Profile XP Sync**: Mission bonuses update profile level automatically
- ✅ **Leaderboard Endpoint**: `getGlobalLeaderboard(limit)` fetches top N players

### 4. **Real-Time Map Synchronization** (`src/lib/bins.ts`, `MapScreen.tsx`)

- ✅ **Supabase Real-Time Subscriptions**: Listens for bin changes
- ✅ **Add Bin**: Long-press map → syncs to database → all clients see instantly
- ✅ **Remove Bin**: Tap marker → deletes from database → all clients see instantly
- ✅ **Offline Support**: AsyncStorage fallback if Supabase unavailable
- ✅ **De-duplication**: Prevents duplicate bins at same coordinates

### 5. **Android/iOS Safe Area Fixes** (`src/app/(tabs)/_layout.tsx`)

- ✅ **Android-Specific Fix**:
  - Platform check: `Platform.OS === 'android'`
  - SafeAreaView wrapper with bottom inset
  - Dynamic padding: `Math.max(8, insets.bottom)`
  - Fixes system navigation button overlap
- ✅ **iOS Unchanged**:
  - Standard 8px padding (already working perfectly)
  - Home indicator handled naturally
- ✅ **Header Safe-Area**: Top padding applied to all screens

### 6. **File Changes Summary**

| File                                    | Changes                                              |
| --------------------------------------- | ---------------------------------------------------- |
| `src/lib/missions.ts`                   | NEW - Mission logic, caching, reset timers           |
| `src/lib/bins.ts`                       | +179 lines - Real-time DB sync, subscriptions        |
| `src/lib/trashStats.ts`                 | +221 lines - NPC players, leaderboard merge          |
| `src/native/screens/MapScreen.tsx`      | +283 lines - Real-time subscriptions, DB sync        |
| `src/native/screens/MissionsScreen.tsx` | +372 lines - Mission UI, progress bars, modals       |
| `src/web-legacy/pages/Missions.tsx`     | +393 lines - Web mission UI                          |
| `src/app/(tabs)/_layout.tsx`            | +60 lines - Platform-specific safe area              |
| `supabase_setup/`                       | NEW - SQL migrations for missions, leaderboard, bins |
| `scripts/`                              | NEW - Helper scripts for testing                     |

**Total:** 1,840 insertions, 224 deletions

---

## 🔧 Next Steps for the Database/Backend Owner

### ⚠️ CRITICAL: Execute SQL Migrations

Your frontend is ready. Execute these SQL scripts in Supabase dashboard to enable all features:

#### **Step 1: Create Bins Table (Real-Time Map Sync)**

- **File**: `supabase_setup/bins.sql`
- **Location**: Supabase > SQL Editor > New Query
- **What It Does**:
  - Creates `bins` table with `id`, `latitude`, `longitude`, `source`
  - Enables Row Level Security (public read/write)
  - Adds geospatial index for location queries
  - Includes 3 sample bins for testing
- **Copy & Paste**: The entire file, then click **Run**
- **Verify**: Check **Table Editor** → `bins` table should exist

#### **Step 2: Create Leaderboard Table**

- **File**: `supabase_setup/leaderboard.sql`
- **Location**: Supabase > SQL Editor > New Query
- **What It Does**:
  - Creates `leaderboard_scores` table with `user_id`, `display_name`, `total_points`
  - Enables real-time for this table
  - Adds RLS policies for public access
- **Copy & Paste**: The entire file, then click **Run**
- **Verify**: Check **Table Editor** → `leaderboard_scores` table should exist

#### **Step 3: Create Missions Cache Table**

- **File**: `supabase_setup/missions.sql` (if not already created)
- **Location**: Supabase > SQL Editor > New Query
- **What It Does**:
  - Creates `missions_cache` for storing daily/weekly pools per user
  - Optimizes mission reset calculations
- **Copy & Paste**: The entire file, then click **Run**

---

### 🔄 Mission Auto-Reset (Cron Job)

**What Frontend Expects:**

- Daily missions reset at **midnight UTC** (00:00)
- Weekly missions reset every **Monday at 00:00 UTC**

**What Backend Needs to Do:**

Option A: **Supabase Edge Functions** (Recommended)

```bash
1. Create a new Edge Function: supabase > Edge Functions > Create New
2. Name it: reset_missions_daily
3. Schedule it: Add trigger "Every day at 00:00 UTC"
4. Function code should:
   - Query all users in missions_cache table
   - For users: Set daily_reset_at = NOW() + 1 day
   - Set weekly_reset_at = NOW() + 7 days
   - TRUNCATE daily missions for this user
```

Option B: **External Cron (node-cron, AWS Lambda, etc.)**

```bash
POST /api/cron/reset-missions
- Runs daily at 00:00 UTC
- Clears missions_cache for all users
- Updates reset timestamps
```

**Your Job as Backend Owner:**

- Set up ONE cron that runs `/api/missions/reset` daily
- Reset should clear cached missions + update timestamps
- Frontend will re-fetch fresh missions on app open

---

### 📊 Leaderboard Endpoint

**What Frontend Expects:**

- Endpoint that returns real users sorted by EcoXP descending
- Format: `[{user_id, display_name, total_points}, ...]`

**What Backend Needs to Provide:**

Create this endpoint:

```
GET /api/leaderboard?limit=20

Response:
[
  {
    user_id: "user-uuid-1",
    display_name: "Alice",
    total_points: 450000
  },
  {
    user_id: "user-uuid-2",
    display_name: "Bob",
    total_points: 380000
  },
  ...
]
```

**Frontend Will Handle:**

- Merge real users above with NPCs (Erina, Art, Kenan)
- Sort combined list by total_points descending
- Display top 3

**Implementation:**

```sql
-- Your backend should query leaderboard_scores table:
SELECT user_id, display_name, total_points
FROM leaderboard_scores
ORDER BY total_points DESC
LIMIT ?;
```

---

### 🗺️ Real-Time Bin Sync (Already Enabled)

**Status:** ✅ Frontend code is ready. Database half is done.

**What's Needed:**

1. **Enable Realtime on bins Table:**
   - Supabase Dashboard > Replication > bins table
   - Toggle **ON** for "Realtime"
   - This enables `postgres_changes` events

2. **Verify RLS Policies:**
   - Check `bins` table has policies:
     - `Allow public read access` (SELECT)
     - `Allow public insert` (INSERT)
     - `Allow public delete` (DELETE)
   - (Already in `bins.sql` if you ran it)

3. **How It Works:**
   - User A adds bin → Frontend calls `addBinToDatabase()`
   - Insert triggers → Supabase emits `postgres_changes` event
   - All subscribed clients (Users B, C) receive update
   - `subscribeToBinsRealtimeUpdates()` callback fires
   - Map re-renders with new bin instantly ✓

**Testing:**

```
1. Run app on Device A
2. Run app on Device B
3. Device A: Long-press map to add bin
4. Device B: Marker appears instantly (no refresh needed)
```

---

## 📋 Deployment Checklist

- [ ] Execute `supabase_setup/bins.sql` in Supabase SQL Editor
- [ ] Execute `supabase_setup/leaderboard.sql` in Supabase SQL Editor
- [ ] Enable Realtime on `bins` table (Replication settings)
- [ ] Enable Realtime on `leaderboard_scores` table
- [ ] Set up cron job for daily mission reset @00:00 UTC
- [ ] Create `/api/leaderboard` endpoint (return users sorted by EcoXP)
- [ ] Test missions reset (daily/weekly)
- [ ] Test real-time bin sync across devices
- [ ] Test leaderboard fetch (real users + NPCs merging)

---

## 🚀 Testing Instructions

### **Test Mission System**

1. Open app → Go to Missions tab
2. Complete a daily mission (capture 3+ items in category)
3. "Claim XP" button appears
4. Tap → XP awarded → Profile XP updates
5. Next day → Daily missions reset with new pool

### **Test Leaderboard**

1. Go to Missions screen
2. Scroll down → See "Top 3 Players"
3. Should show mix of real users + NPCs (Erina, Art, Kenan)
4. Sorted by EcoXP descending

### **Test Real-Time Bin Sync**

1. Open app on Device A (emulator/real phone)
2. Open app on Device B (another emulator/real phone)
3. Device A: Long-press map → Add bin at (41.33, 19.82)
4. Device B: Marker appears instantly ✓
5. Device B: Tap marker → Remove
6. Device A: Marker disappears instantly ✓

---

## 📞 Questions?

- **Missions not resetting?** → Check cron job is running daily
- **Leaderboard empty?** → Check `leaderboard_scores` table has data
- **Real-time not working?** → Verify Realtime enabled on `bins` table
- **NPC players not showing?** → Frontend is ready; ensure backend endpoint works

---

**Frontend Ready: ✅ May 3, 2026**  
**Backend Tasks: ⏳ Pending SQL + Cron + Endpoint setup**
