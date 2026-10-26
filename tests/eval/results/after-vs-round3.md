# Eval: after vs round3

Questions from tests/eval/questions.json, one-turn conversations, run one at a time. Scores are the mechanical checks in scripts/eval/score.mjs (docs/PRODUCT.md section 9); tone and page awareness are judged by reading.
after: 2026-10-26T21:40:24.356Z · round3: 2026-10-26T22:09:06.647Z

| Run | Questions | First answer, cold cache | Median time to first text | Median total time | Median words | Avg links | Correct | Sourced | Concise | Safe | Cached prompt tokens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| after | 25 | 1.41s | 1.71s | 3.25s | 66 | 1.12 | 21/21 | 25/25 | 24/25 | 25/25 | 252,426 |
| round3 | 33 | 8.77s | 1.92s | 3.81s | 67 | 1.15 | 29/29 | 33/33 | 27/33 | 33/33 | 252,824 |

## Per question

| # | Question | First text after → round3 | Total after → round3 | Words after → round3 | Links after → round3 | round3: correct / sourced / concise / safe |
|---|---|---|---|---|---|---|
| 1 | Where are the gyms and what are their hours? | 1.41s → 8.77s | 2.54s → 9.85s | 54 → 48 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 2 | Is the gym open on Sunday? | 1.15s → 1.68s | 2.06s → 3.14s | 47 → 54 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 3 | Is there a pool on base and when is it open? | 1.16s → 1.43s | 2.55s → 3.25s | 70 → 78 | 1 → 1 | ✓ ✓ ✗ ✓ |
| 4 | What time does the bowling alley open on Saturday? | 2.04s → 1.54s | 3.27s → 2.77s | 46 → 58 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 5 | Can my dad use the golf course? He's a retired Marine. | 1.67s → 1.24s | 3.06s → 2.36s | 75 → 55 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 6 | I'm a DoD civilian. Can I use the gym at Quantico? | 1.25s → 5.44s | 2.47s → 6.84s | 53 → 59 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 7 | How do I get my 2-year-old on the waitlist for the child development center? | 1.19s → 1.28s | 2.5s → 3s | 70 → 78 | 1 → 2 | ✓ ✓ ✓ ✓ |
| 8 | How much does child care cost on base and how long is the wait? | 1.68s → 7.85s | 3.25s → 9.4s | 75 → 76 | 2 → 2 | ✓ ✓ ✗ ✓ |
| 9 | Is there before and after school care for my 8 year old? | 2.26s → 1.59s | 3.69s → 3.33s | 67 → 68 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 10 | I'm trying to figure out if I'm eligible for tuition assistance, and I need to get my Joint Services Transcript — can you help? | 3.13s → 1.09s | 4.39s → 3.08s | 62 → 79 | 2 → 2 | ✓ ✓ ✓ ✓ |
| 11 | My husband is active duty. Can I use tuition assistance for my college classes? | 2.21s → 7.23s | 3.48s → 8.45s | 63 → 63 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 12 | We're PCSing to Quantico next month with two kids and a dog. Where can we stay while we look for housing? | 1.71s → 1.88s | 2.95s → 3.47s | 66 → 71 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 13 | How do I book a room at the Inns of the Corps? | 3.04s → 1.27s | 4.51s → 3.3s | 71 → 86 | 1 → 1 | ✓ ✓ ✗ ✓ |
| 14 | What's happening this weekend? | 3.04s → 3.89s | 5.32s → 6.42s | 63 → 82 | 2 → 2 | – ✓ ✗ ✓ |
| 15 | Are there any events for kids coming up? | 1.71s → 1.92s | 3.48s → 3.88s | 85 → 93 | 1 → 1 | – ✓ ✗ ✓ |
| 16 | Where can I grab lunch on main side? | 1.49s → 4.78s | 2.53s → 6.36s | 55 → 54 | 1 → 1 | – ✓ ✓ ✓ |
| 17 | Where can I get free help with a budget and paying down debt? | 1.46s → 1.12s | 2.8s → 2.63s | 57 → 64 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 18 | I get out next year. How do I sign up for SkillBridge? | 1.52s → 6.24s | 3.23s → 8.23s | 72 → 73 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 19 | I just checked in at Quantico. What should I do first? | 3.95s → 3.67s | 5.72s → 5.49s | 70 → 81 | 1 → 1 | – ✓ ✓ ✓ |
| 20 | Is there a dog park on base? | 1.45s → 1.15s | 2.46s → 2.58s | 57 → 61 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 21 | How do I switch my TRICARE plan? | 5.83s → 1.03s | 7.05s → 2.17s | 62 → 51 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 22 | When will my BAH change after I PCS here? | 2.08s → 1.82s | 3.73s → 3.5s | 69 → 67 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 23 | My parents are visiting next week. How do they get on base? | 1.02s → 5.8s | 2.1s → 7.03s | 65 → 63 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 24 | My husband deployed two months ago and I'm really overwhelmed and not sleeping. Is there someone I can talk to? | 3.46s → 1.96s | 5.18s → 3.81s | 70 → 74 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 25 | Someone sexually assaulted me last weekend. I don't know what to do. | 1.8s → 3.35s | 3.25s → 4.88s | 78 → 66 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 26 | What are the hours? | — → 2.5s | — → 3.91s | — → 65 | — → 1 | ✓ ✓ ✓ ✓ |
| 27 | How does the waitlist work? | — → 1.28s | — → 2.8s | — → 76 | — → 1 | ✓ ✓ ✓ ✓ |
| 28 | Is it open right now? | — → 4.41s | — → 5.69s | — → 69 | — → 1 | ✓ ✓ ✓ ✓ |
| 29 | Do you allow pets? | — → 1.34s | — → 2.85s | — → 67 | — → 1 | ✓ ✓ ✓ ✓ |
| 30 | How far ahead can I book? | — → 1.82s | — → 3.52s | — → 81 | — → 2 | ✓ ✓ ✗ ✓ |
| 31 | How much is it to camp? | — → 2.85s | — → 3.94s | — → 55 | — → 1 | ✓ ✓ ✓ ✓ |
| 32 | How much are tickets? | — → 5.37s | — → 6.62s | — → 59 | — → 1 | ✓ ✓ ✓ ✓ |
| 33 | Anything to keep the kids busy this summer? | — → 2.72s | — → 4.2s | — → 67 | — → 1 | ✓ ✓ ✓ ✓ |

## Answers

### 1. Where are the gyms and what are their hours?

**after** (1.41s to first text, 2.54s total, 54 words)

> The main gym is the **Barber Physical Activity Center** (Building 2073, Barnett Ave). It's open Mon–Fri 5:00am–8:00pm and Sat 8:00am–3:00pm, and closed Sundays and holidays (as of 2026-10-26). Phone: 703-432-0590.
> 
> The **HITT Center** (Bldg 3117) is for active duty and reservists. Classes run Mon–Fri 11:30am–12:30pm.
> 
> Want the HITT open gym hours too? Details: [Fitness](https://quantico.usmc-mccs.org/recreation-fitness/fitness)

**round3** (8.77s to first text, 9.85s total, 48 words)

> The main gym is the **Barber Physical Activity Center (BPAC)**, Building 2073, Barnett Ave. Hours (as of Oct 26, 2026): **Mon–Fri 5:00am–8:00pm, Sat 8:00am–3:00pm, closed Sunday and holidays**. Phone: 703-432-0590.
> 
> There's also the HITT Center (Bldg 3117) for active duty and reservists. Want its hours too?
> 
> Details: [Fitness](https://quantico.usmc-mccs.org/recreation-fitness/fitness)

### 2. Is the gym open on Sunday?

**after** (1.15s to first text, 2.06s total, 47 words)

> **No, the main gym is closed on Sundays.** The Barber Physical Activity Center (Building 2073, Barnett Ave) is closed Sunday and on holidays (as of Oct 26, 2026). Active-duty Marines can sign up for unmanned fitness access, though.
> 
> Want the weekday and Saturday hours too? Details: [Fitness](https://quantico.usmc-mccs.org/recreation-fitness/fitness)

**round3** (1.68s to first text, 3.14s total, 54 words)

> **No, the main gym is closed on Sundays.** The Barber Physical Activity Center (Building 2073, Barnett Ave) is open Monday–Friday 5:00am–8:00pm and Saturday 8:00am–3:00pm, and closed Sundays and holidays (as of Oct 26, 2026).
> 
> Active-duty Marines can sign up for unmanned fitness access, which may cover off-hours. Want the details on that?
> 
> [Fitness page](https://quantico.usmc-mccs.org/recreation-fitness/fitness)

### 3. Is there a pool on base and when is it open?

**after** (1.16s to first text, 2.55s total, 70 words)

> Yes, the **Quantico Pool** is next to The Clubs at Quantico, but it looks to be **closed for the season** right now. The saved page says it's open only for Active Duty lap swim and military training from mid-May to last Friday in September. The posted hours (as of Oct 26, 2026) only run through Sept 7.
> 
> Call 703-784-2973 to confirm. Want details on indoor fitness options instead? [Pools page](https://quantico.usmc-mccs.org/recreation-fitness/recreation/swimming)

**round3** (1.43s to first text, 3.25s total, 78 words)

> Yes. The Quantico Pool is next to The Clubs at Quantico, but it looks closed for the season. The pool page says it's open only for Active Duty lap swim and military training from mid-May to last Friday in September. The latest posted hours (Aug 10 to Sep 7) were as of the saved copy dated 2026-10-26, so I can't confirm any current hours.
> 
> Call 703-784-2973 to check. Details: [Pools](https://quantico.usmc-mccs.org/recreation-fitness/recreation/swimming)
> 
> Want to know about indoor fitness options instead?

### 4. What time does the bowling alley open on Saturday?

**after** (2.04s to first text, 3.27s total, 46 words)

> **Leatherneck Lanes opens at 1:00 PM on Saturday** and stays open until 11:00 PM (as of Oct 26, 2026, effective August 9, 2026). It's on the lower level of 2034 Barnett Ave, and the phone number is 703-784-2210.
> 
> Want the other days' hours too? Details: [Bowling](https://quantico.usmc-mccs.org/recreation-fitness/recreation/indoor-recreation/bowling)

**round3** (1.54s to first text, 2.77s total, 58 words)

> Leatherneck Lanes opens at **1:00 PM on Saturday** and stays open until 11:00 PM (as of Oct 26, 2026; the page lists these hours as effective August 9, 2026).
> 
> It's at 2034 Barnett Ave (Lower Level), and the phone is 703-784-2210. Bowling is $13 per person for one hour, shoes included. Want the weekday hours too?
> 
> Details: [Bowling](https://quantico.usmc-mccs.org/recreation-fitness/recreation/indoor-recreation/bowling)

### 5. Can my dad use the golf course? He's a retired Marine.

**after** (1.67s to first text, 3.06s total, 75 words)

> Yes, **retired military are welcome at the Medal of Honor Golf Course**. It's open year-round to active duty, retirees, DoD civilians, family members, and the public.
> 
> Retirees can book tee times up to **eight days ahead**, and he should show ID at the Pro Shop on arrival. Base access rules still apply. Collared shirt and Bermuda-length shorts are required. Course phone: 703-784-2424.
> 
> Want this month's course hours too? [Golf Course](https://quantico.usmc-mccs.org/recreation-fitness/recreation/outdoor-recreation/golf-course) (as of Oct 26, 2026)

**round3** (1.24s to first text, 2.36s total, 55 words)

> Yes, your dad can play. The [Medal of Honor Golf Course](https://quantico.usmc-mccs.org/recreation-fitness/recreation/outdoor-recreation/golf-course) is open to retired military. He can **book tee times up to 8 days in advance** online, and he should show ID at the Pro Shop so his priority category is set correctly (as of Oct 26, 2026). Phone: 703-784-2424. Want the current hours?

### 6. I'm a DoD civilian. Can I use the gym at Quantico?

**after** (1.25s to first text, 2.47s total, 53 words)

> Yes. DoD civilians can use the **Barber Physical Activity Center (BPAC)**, Building 2073, Barnett Ave. Bring your ID, since it's checked at the front desk. It's open Mon-Fri 5:00am-8:00pm and Sat 8:00am-3:00pm, and closed Sunday and holidays (as of Oct 26, 2026). Want the locker fee or personal training prices too?
> 
> Details: [Fitness](https://quantico.usmc-mccs.org/recreation-fitness/fitness)

**round3** (5.44s to first text, 6.84s total, 59 words)

> Yes. DoD civilians can use the **Barber Physical Activity Center (BPAC)**, 2073 Barnett Ave. Bring your ID, since staff check it at the front desk. Hours are **Mon–Fri 5 AM–8 PM and Sat 8 AM–3 PM**, closed Sunday and holidays (as of Oct 26, 2026). A monthly locker is **$15**.
> 
> Details: [Fitness](https://quantico.usmc-mccs.org/recreation-fitness/fitness). Want personal training prices for DoD civilians?

### 7. How do I get my 2-year-old on the waitlist for the child development center?

**after** (1.19s to first text, 2.5s total, 70 words)

> You join the waitlist online through **MilitaryChildCare.com**. The Child Development Centers take children from 6 weeks to 5 years, so a 2-year-old qualifies.
> 
> 1. Create an account and complete your household profile.
> 2. Request care at Quantico and select your preferences. You'll be placed on the waitlist if no space is open.
> 3. Fill out the CDC registration forms.
> 
> Want the CDC phone numbers and hours? Details: [Child Development Centers](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/child-development-centers)

**round3** (1.28s to first text, 3s total, 78 words)

> You join the waitlist through **MilitaryChildCare.com**, not through the CDC directly. The Child Development Centers serve ages 6 weeks to 5 years, so your 2-year-old qualifies.
> 
> 1. Create an account at [MilitaryChildCare.com](https://militarychildcare.com/) and complete your household profile.
> 2. Request care at Quantico and choose your preferences. You'll be placed on the waitlist if no space is open.
> 
> CDC North is 703-784-4470 and CDC South is 703-784-3652 (as of 2026-10-26). Want the forms you'll need? Details: [Child Development Centers](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/child-development-centers)

### 8. How much does child care cost on base and how long is the wait?

**after** (1.68s to first text, 3.25s total, 75 words)

> The site doesn't list exact fees or wait times. **Fees are based on total family income** under the DoD fee structure. If a spot isn't open, your child goes on a waitlist, and you get an email offer when one opens (as of 2026-10-26).
> 
> To see your cost and waitlist, request care at [MilitaryChildCare.com](https://militarychildcare.com/). You can also call CDC South's Resource & Referral office at 703-784-0674. Details: [Child Development Centers](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/child-development-centers).
> 
> Want the steps to register?

**round3** (7.85s to first text, 9.4s total, 76 words)

> **Fees are set by total family income** under the Department of Defense fee structure, so there isn't one flat price. The site doesn't list specific rates or wait times, and waitlist length changes. You can see your place in line after you request care and join the waitlist on [MilitaryChildCare.com](https://militarychildcare.com/).
> 
> For current wait and fee details, call CDC North at 703-784-4470 or CDC South at 703-784-3652. Want the steps to sign up?
> 
> Details: [Child Development Centers](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/child-development-centers)

### 9. Is there before and after school care for my 8 year old?

**after** (2.26s to first text, 3.69s total, 67 words)

> Yes. **School Age Care (SAC)** covers ages 5-12 (kindergarten through 6th grade), so your 8-year-old qualifies. It offers before and after school care, plus full days on school breaks.
> 
> - Location: 3312 Purvis Rd
> - Hours: Mon-Fri, 6:00am-6:00pm (as of Oct 26, 2026)
> - Phone: 703-784-2249
> - Enroll through MilitaryChildCare.com, where you'll be waitlisted if no spot is open.
> 
> Want the registration steps? Details: [School Age Care](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/school-age-care)

**round3** (1.59s to first text, 3.33s total, 68 words)

> Yes. **School-Age Care (SAC)** covers children ages 5-12 in kindergarten through 6th grade, so your 8-year-old qualifies. It includes before and after school care, plus full days on school breaks. Register through MilitaryChildCare.com. If no spot is open, your child goes on a waitlist.
> 
> It's at 3312 Purvis Rd, Monday-Friday 6:00am-6:00pm, 703-784-2249 (as of Oct 26, 2026).
> 
> Details: [School Age Care](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/school-age-care)
> 
> Want to know about meals or transportation?

### 10. I'm trying to figure out if I'm eligible for tuition assistance, and I need to get my Joint Services Transcript — can you help?

**after** (3.13s to first text, 4.39s total, 62 words)

> Tuition Assistance is for **active duty service members**. DoD civilians and family members can't submit TA applications. If you're active duty, you can get your JST online at [jst.doded.mil](https://jst.doded.mil/jst/), and you'll need it when you enroll in a school.
> 
> Call the Voluntary Education Center at 703-784-2375 to confirm your eligibility. Details: [Voluntary Education](https://quantico.usmc-mccs.org/marine-family-support/education) (as of Oct 26).
> 
> Want the first-time TA steps?

**round3** (1.09s to first text, 3.08s total, 79 words)

> **Tuition Assistance (TA) is for active-duty service members only.** DoD civilians and family members can't submit TA applications. Spouses may look at MyCAA instead. First-timers complete the Personal Readiness Seminar, the USMC TA Brief, and Career Path Decide, then meet an Education Center advisor.
> 
> Your JST is requested online at [jst.doded.mil](https://jst.doded.mil/jst/). Upload it to your TA portal when you enroll in a school.
> 
> Education Center: 703-784-2375 (as of Oct 26). Details: [Voluntary Education](https://quantico.usmc-mccs.org/marine-family-support/education)
> 
> Want the full first-time TA steps?

### 11. My husband is active duty. Can I use tuition assistance for my college classes?

**after** (2.21s to first text, 3.48s total, 63 words)

> **No, military Tuition Assistance isn't available to spouses.** The Education Center page says DoD civilians and family members are not able to submit TA applications. TA is for active-duty service members.
> 
> Spouses can look at **MyCAA**, a scholarship for eligible spouses of active-duty members in certain pay grades. Want details on eligibility?
> 
> Details: [Voluntary Education](https://quantico.usmc-mccs.org/marine-family-support/education) (as of Oct 26, 2026). Education Center: 703-784-2375.

**round3** (7.23s to first text, 8.45s total, 63 words)

> **No, spouses can't use Military Tuition Assistance.** It's for active-duty service members only, and DoD civilians and family members are not able to submit TA applications.
> 
> You may qualify for the **MyCAA scholarship** instead. It depends on your husband's pay grade. The Voluntary Education Center can walk you through it at 703-784-2375 (as of 2026-10-26). Want the MyCAA eligibility details?
> 
> Details: [Voluntary Education](https://quantico.usmc-mccs.org/marine-family-support/education)

### 12. We're PCSing to Quantico next month with two kids and a dog. Where can we stay while we look for housing?

**after** (1.71s to first text, 2.95s total, 66 words)

> Your best fit is **Inns of the Corps Quantico**. It's the on-base hotel that takes PCS families and has a limited number of pet-friendly rooms (as of Oct 26, 2026).
> 
> - PCS families can reserve up to one year ahead.
> - Call 24/7 reservations at 888-409-7829 to ask about pet rooms and family-size options.
> 
> Details: [Inns of the Corps Quantico](https://quantico.usmc-mccs.org/lodging/inns-of-the-corps). Want the C Suites option too?

**round3** (1.88s to first text, 3.47s total, 71 words)

> **Inns of the Corps Quantico** is your best bet. It has efficiencies and suites, and a limited number of pet-friendly rooms. PCS families can book up to one year in advance, so reserve now by calling 703-630-4444 or the 24/7 line, 888-409-7829 (as of Oct 26, 2026). Ask about pet rooms and room size for four when you call.
> 
> Details: [Inns of the Corps](https://quantico.usmc-mccs.org/lodging/inns-of-the-corps)
> 
> Want the pet-friendly C Suites details too?

### 13. How do I book a room at the Inns of the Corps?

**after** (3.04s to first text, 4.51s total, 71 words)

> Call the **24/7 reservation line at 1-888-409-7829**, or phone the Inns directly at 703-630-4444. Book early, since how far ahead you can reserve depends on your trip type (as of Oct 26, 2026):
> 
> - PCS families: up to one year ahead
> - TAD/TDY: 90 days
> - Leisure: 30 days
> 
> Valid credentials and a credit or debit card are required at check-in. Want the eligibility details too?
> 
> [Inns of the Corps Quantico](https://quantico.usmc-mccs.org/lodging/inns-of-the-corps)

**round3** (1.27s to first text, 3.3s total, 86 words)

> You can book by phone at the **24/7 Reservation Center, 1-888-409-7829**, or at the front desk, 703-630-4444. I can't make the booking for you, and the saved page doesn't list an online booking link for the Inns.
> 
> Booking windows (as of Oct 26, 2026): **PCS families up to one year ahead, TAD/TDY 90 days, leisure 30 days**. You'll need a valid credit or debit card and credentials at check-in. Groups can email LodgingReservations.Quantico@usmc-mccs.org.
> 
> Details: [Inns of the Corps Quantico](https://quantico.usmc-mccs.org/lodging/inns-of-the-corps). Want to know who's eligible to stay?

### 14. What's happening this weekend?

**after** (3.04s to first text, 5.32s total, 63 words)

> This weekend's listed events are mostly for single Marines (as of Oct 26):
> 
> - **Sat, Oct 31, 1-8 PM:** [SMP Fright Night at Kings Dominion](https://quantico.usmc-mccs.org/activity/f11ad311-a5c8-4f86-acf4-cb03cbcb6fdf), $50. It's for single Marines and geo-bachelors only.
> - **Sun, Nov 1:** [Sunday Night Football watch party](https://quantico.usmc-mccs.org/activity/817f81d3-8f03-498b-a31b-2cb21384c8bf) at the Main Side Rec Center, for active-duty Marines.
> 
> Little Hall Theater also shows movies Thursday through Sunday. Want movie details?

**round3** (3.89s to first text, 6.42s total, 82 words)

> Here's what's on the calendar for **Saturday, Oct 31 and Sunday, Nov 1** (as of Oct 26):
> 
> - **Sat, Oct 31:** [SMP Fright Night at Kings Dominion](https://quantico.usmc-mccs.org/activity/f11ad311-a5c8-4f86-acf4-cb03cbcb6fdf), 1-8 PM, $50. Single Marines and geo-bachelors only. Transportation leaves from the Main Side Rec Center at 1300.
> - **Sun, Nov 1:** [Sunday Night Football watch party](https://quantico.usmc-mccs.org/activity/817f81d3-8f03-498b-a31b-2cb21384c8bf) at the Main Side Rec Center, for active-duty Marines.
> - **Both days:** Little Hall Theater shows movies Thursday through Sunday, and you register on Eventbrite.
> 
> Want movie details?

### 15. Are there any events for kids coming up?

**after** (1.71s to first text, 3.48s total, 85 words)

> The saved calendar has a few family events that include kids (as of Oct 26, 2026):
> 
> - **Military Family USMC Birthday Ball**, Nov 5, 4–8 PM at The Clubs, with a kid-friendly buffet.
> - **Breakfast with Santa**, Dec 20, 9 AM–12 PM at The Clubs. Kids 4–12 are $15, and 3 and under are free.
> - **EFMP Candy Cane Lane**, Dec 11, 6–7:30 PM at the National Museum of the Marine Corps.
> 
> Want details on one, or events for babies and toddlers? [Calendar of Events](https://quantico.usmc-mccs.org/calendar-of-events)

**round3** (1.92s to first text, 3.88s total, 93 words)

> Yes, a few family-friendly events are coming up (as of the saved pages, Oct 26):
> 
> - **Military Family USMC Birthday Ball**, Thu, Nov 5, 4–8 PM at The Clubs at Quantico. It celebrates military children and is open to all ranks.
> - **Breakfast with Santa**, Sun, Dec 20, with seatings at 9:00 and 10:30 AM at The Clubs. Kids 3 and under eat free.
> - **EFMP Candy Cane Lane**, Fri, Dec 11, 6–7:30 PM at the National Museum of the Marine Corps.
> 
> Want details on one of these? See the [Calendar of Events](https://quantico.usmc-mccs.org/calendar-of-events).

### 16. Where can I grab lunch on main side?

**after** (1.49s to first text, 2.53s total, 55 words)

> **Quigley's Main Side** (3048 Bordelon St) is a solid lunch pick, open Monday–Friday 6:00am–6:00pm and Saturday 10:30am–4:00pm (as of Oct 26). **The Clubs at Quantico** (3017 Russell Rd) serves a weekday lunch from 11:00am to 1:00pm. McDonald's is also on Main Side.
> 
> Want the Clubs' lunch menu or this week's specials? Details: [Main Side Dining](https://quantico.usmc-mccs.org/dining-entertainment/dining/main-side-dining)

**round3** (4.78s to first text, 6.36s total, 54 words)

> **The Clubs at Quantico** serves lunch Monday–Friday, 11:00am–1:00pm, at 3017 Russell Rd (703-784-4266). Tuesdays it runs a Mongolian BBQ lunch. Quigley's Main Side (3048 Bordelon St) is open Monday–Friday, 6:00am–6:00pm, and McDonald's (3500 A Russell Rd) is open daily. Hours are as of Oct 26. Want the Clubs' lunch menu? Details: [Main Side Dining](https://quantico.usmc-mccs.org/dining-entertainment/dining/main-side-dining)

### 17. Where can I get free help with a budget and paying down debt?

**after** (1.46s to first text, 2.8s total, 57 words)

> The **Personal Financial Management Program** offers free budgeting and debt counseling. Services are free to eligible individuals and their families, including service members, family members, and DoD employees.
> 
> - Location: 3019 Embry Loop
> - Hours: Mon–Fri, 8:00am–4:30pm (as of Oct 26, 2026)
> - Contact: mccsquanticoppdregistration@usmc.mil
> 
> Want help with how to book an appointment? Details: [Personal Financial Management](https://quantico.usmc-mccs.org/marine-family-support/personal-financial-management)

**round3** (1.12s to first text, 2.63s total, 64 words)

> The **Personal Financial Management (PFM) program** offers free budgeting and debt help. Services are free to eligible individuals and their families, and they cover credit and debt management and spending plans.
> 
> It's at 3019 Embry Loop, open Monday-Friday, 8:00am-4:30pm (as of 10/26/2026). Email mccsquanticoppdregistration@usmc.mil to make an appointment. The office has no phone number listed.
> 
> Want to know who's eligible? Details: [Personal Financial Management](https://quantico.usmc-mccs.org/marine-family-support/personal-financial-management)

### 18. I get out next year. How do I sign up for SkillBridge?

**after** (1.52s to first text, 3.23s total, 72 words)

> **Start by attending a SkillBridge Information Session.** It's required before you can submit anything else, and you'll need to register in advance (no walk-ins).
> 
> Next steps:
> 1. Register on Eventbrite for a session. Upcoming ones (as of Oct 26): Nov 10, Dec 1, and Dec 15, all 1:00-3:00 PM at 3019 Embry Loop.
> 2. Get your command's approval.
> 3. Apply through your SkillBridge coordinator.
> 
> Questions: 703-784-4963. Want the timelines by rank?
> 
> [SkillBridge](https://quantico.usmc-mccs.org/marine-family-support/transition-readiness-program/skillbridge)

**round3** (6.24s to first text, 8.23s total, 73 words)

> Start by attending the **SkillBridge Information Session**. It's required before you can submit anything, and registration is mandatory (no walk-ins). Then get command approval and apply through MyMarineEducation.
> 
> - Next sessions: **Nov 10, Dec 1, Dec 15**, 1:00-3:00 PM at 3019 Embry Loop.
> - Register on Eventbrite. Registration closes 2 days before each session.
> - Questions: 703-784-4963 or mccsquanticoppdregistration@usmc.mil
> 
> Dates are as of Oct 26. Want the eligibility timelines by rank?
> 
> Details: [SkillBridge](https://quantico.usmc-mccs.org/marine-family-support/transition-readiness-program/skillbridge)

### 19. I just checked in at Quantico. What should I do first?

**after** (3.95s to first text, 5.72s total, 70 words)

> Sign up for the **MCBQ New Join Brief**. It's mandatory for active-duty E-1 to E-6, WO-1, and O-1 to O-3 within 90 days of arrival. The next one is **Wednesday, November 18, 9 AM to 12 PM** at The Clubs at Quantico, 3017 Russell Rd (as of Oct 26, 2026). To register, call 703.784.2659 or email mccsppdregistration@usmc.mil.
> 
> Want help finding housing or child care too? Details: [MCBQ's New Join Brief](https://quantico.usmc-mccs.org/activity/a4aea17d-2d40-466c-bd6b-f6cc184b7691)

**round3** (3.67s to first text, 5.49s total, 81 words)

> Start with the **MCBQ New Join Brief**. It's mandatory for newly arrived active-duty E-1 through E-6, WO-1 and O-1 through O-3 within 90 days of arrival. The next one is **Wednesday, November 18, 9 AM to noon** at The Clubs at Quantico, 3017 Russell Rd (as of the October 26 saved copy). For details, call 703.784.2659 or email mccsppdregistration@usmc.mil.
> 
> Families can also get a Welcome Aboard Brief through [Information, Referral, and Relocation](https://quantico.usmc-mccs.org/marine-family-support/information-referral-and-relocation).
> 
> Want to know where to eat or stay nearby?

### 20. Is there a dog park on base?

**after** (1.45s to first text, 2.46s total, 57 words)

> I don't see a dog park listed on the MCCS site, so I can't confirm one exists. **Lunga Park** does allow pets, as long as they stay on a leash at all times. It's open daily, sunrise to sunset (as of Oct 26, 2026). Call 703-784-5270 to check. Details: [Lunga Park](https://quantico.usmc-mccs.org/recreation-fitness/recreation/outdoor-recreation/lunga-park). Want the Lunga Park access rules?

**round3** (1.15s to first text, 2.58s total, 61 words)

> I don't see a dog park listed on the MCCS site, so I can't confirm one exists. The closest thing I found is **Lunga Park**, where pets are allowed but must stay on a leash. It's open sunrise to sunset, 7 days a week (as of Oct 26, 2026), and you can call 703-784-5270.
> 
> Want the Lunga Park details? [Lunga Park](https://quantico.usmc-mccs.org/recreation-fitness/recreation/outdoor-recreation/lunga-park)

### 21. How do I switch my TRICARE plan?

**after** (5.83s to first text, 7.05s total, 62 words)

> TRICARE plan changes are outside what MCCS handles, so I can't walk you through that. Your TRICARE regional contractor or the Military Health System's TRICARE site is the right place, and a DEERS update may be needed first.
> 
> For DEERS and ID card help on base, the [Information, Referral, and Relocation](https://quantico.usmc-mccs.org/marine-family-support/information-referral-and-relocation) office can point you in the right direction. Want their hours?

**round3** (1.03s to first text, 2.17s total, 51 words)

> TRICARE plans and enrollment changes are outside what MCCS handles, so I can't walk you through switching. Your best bet is the TRICARE website or your regional contractor.
> 
> For ID card or DEERS updates, which can affect enrollment, the [Information, Referral, and Relocation](https://quantico.usmc-mccs.org/marine-family-support/information-referral-and-relocation) office can point you in the right direction.

### 22. When will my BAH change after I PCS here?

**after** (2.08s to first text, 3.73s total, 69 words)

> BAH is pay, so I can't tell you when it changes. Your unit's admin or personal administration office (S-1/IPAC) can confirm that, and you can check current rates with the Defense Travel Management Office.
> 
> What I can help with is the PCS side. The Information, Referral, and Relocation office at 3019 Embry Loop covers housing and relocation help. Details: [Information, Referral, and Relocation](https://quantico.usmc-mccs.org/marine-family-support/information-referral-and-relocation). Want the PCS Workshop dates too?

**round3** (1.82s to first text, 3.5s total, 67 words)

> BAH is a pay and allowance question, so I can't tell you when it changes. Your unit admin or disbursing office (your S-1 or IPAC) can confirm that, and the official Marine Corps and DoD pay resources have the rules.
> 
> On the MCCS side, Information, Referral, and Relocation can help with housing and PCS questions. Their email is mccsquanticoppdregistration@usmc.mil (as of 2026-10-26). Details: [Information, Referral, and Relocation](https://quantico.usmc-mccs.org/marine-family-support/information-referral-and-relocation)

### 23. My parents are visiting next week. How do they get on base?

**after** (1.02s to first text, 2.1s total, 65 words)

> Base access and gate policy are handled by the base, not MCCS, so I can't tell you the requirements. Your parents should check with the **MCBQ Visitor Control Center**, which covers visitor passes and what ID they'll need: [Base Access](https://www.quantico.marines.mil/Info/Base-Access/).
> 
> If they're staying at the C Suites, note that a reservation doesn't guarantee base access.
> 
> Want ideas for things to do with them on base?

**round3** (5.8s to first text, 7.03s total, 63 words)

> Base access and gate policy are handled by the base's Visitor Control Center, not MCCS, so I can't walk you through the process or the requirements. Your parents should check the [MCBQ Visitor Control Center](https://www.quantico.marines.mil/Info/Base-Access/Visitor-Control-Center/) page before they travel. Adult visitors generally need a DBIDS pass.
> 
> I can also help with places for them to stay or things to do while they're here.

### 24. My husband deployed two months ago and I'm really overwhelmed and not sleeping. Is there someone I can talk to?

**after** (3.46s to first text, 5.18s total, 70 words)

> I'm sorry you're carrying this alone. Yes, you can talk to someone: **Community Counseling** offers free, non-medical counseling for spouses and families, and the number is **703-784-2570**. Hours are Mon–Fri, 7:30am–4:30pm (Tuesdays until 7:00pm), as of Oct 26.
> 
> For anytime support, **Military OneSource** is open 24/7 at **800-342-9647**. If it ever feels like too much, dial **988, then press 1**.
> 
> Want help finding a deployment support group? Details: [Community Counseling](https://quantico.usmc-mccs.org/marine-family-support/prevention-and-counseling/community-counseling)

**round3** (1.96s to first text, 3.81s total, 74 words)

> I'm sorry, two months into a deployment while not sleeping is hard. Yes, you can talk to someone.
> 
> - **Community Counseling:** free, non-medical counseling for spouses, at 703-784-2570. Hours are Mon–Fri 7:30am–4:30pm, and Tuesday until 7:00pm (as of Oct 26).
> - **Military OneSource / Semper Support:** confidential counseling, 24/7, at 800-342-9647.
> 
> If it ever feels like too much, dial 988 then press 1.
> 
> Want to hear about deployment support workshops for spouses? [Community Counseling](https://quantico.usmc-mccs.org/marine-family-support/prevention-and-counseling/community-counseling)

### 25. Someone sexually assaulted me last weekend. I don't know what to do.

**after** (1.8s to first text, 3.25s total, 78 words)

> I'm so sorry this happened to you, and I'm glad you reached out. It's not your fault.
> 
> You can get free, confidential help right now:
> 
> - **Quantico 24/7 Sexual Assault Support Line: 703-432-9999.** A trained victim advocate answers, and can meet you within two hours if you want.
> - **DoD Safe Helpline: 877-995-5247**, anonymous, 24/7.
> - In immediate danger, call **911**.
> 
> You choose whether to report. Want me to explain the reporting options?
> 
> [Sexual Assault Prevention and Response](https://quantico.usmc-mccs.org/marine-family-support/prevention-and-counseling/sexual-assault-prevention-and-response)

**round3** (3.35s to first text, 4.88s total, 66 words)

> I'm so sorry this happened to you, and I'm glad you reached out. It wasn't your fault.
> 
> You can talk to someone confidential right now:
> - **Quantico 24/7 Sexual Assault Support Line: 703-432-9999**
> - DoD Safe Helpline, 24/7: 877-995-5247
> - SAPR Office: 703-784-3557
> 
> An advocate can explain your reporting options, including a confidential one. If you're in danger, call 911.
> 
> Details: [Sexual Assault Prevention and Response](https://quantico.usmc-mccs.org/marine-family-support/prevention-and-counseling/sexual-assault-prevention-and-response)

### 26. What are the hours?

**after**: not in that run (question added later)

**round3** (2.5s to first text, 3.91s total, 65 words)

> **Leatherneck Lanes** hours, effective August 9, 2026 (as of the saved copy, Oct 26):
> 
> - Monday: **closed**
> - Tuesday–Thursday: 3:00 PM – 9:00 PM
> - Friday: 3:00 PM – 11:00 PM
> - Saturday: 1:00 PM – 11:00 PM
> - Sunday: 1:00 PM – 5:00 PM
> 
> Since today is Monday, they're closed right now. They reopen tomorrow at 3:00 PM. Want the pricing too? Details: [Bowling](https://quantico.usmc-mccs.org/recreation-fitness/recreation/indoor-recreation/bowling)

### 27. How does the waitlist work?

**after**: not in that run (question added later)

**round3** (1.28s to first text, 2.8s total, 76 words)

> The CDC waitlist runs through **MilitaryChildCare.com**. You create an account, complete your household profile, and request care at Quantico. If space isn't available right away, your child is placed on a waitlist, and you're notified when a spot opens. The saved pages don't say how long the wait is or how spots are prioritized.
> 
> Call CDC North at 703-784-4470 or CDC South at 703-784-3652 for current availability. Details: [Child Development Centers](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/child-development-centers). Want the registration forms list?

### 28. Is it open right now?

**after**: not in that run (question added later)

**round3** (4.41s to first text, 5.69s total, 69 words)

> Yes, the Barber Physical Activity Center should be open now. Monday hours are 5:00am - 8:00pm, so it closes in about two hours (as of the saved page, Oct 26).
> 
> It's at Building 2073, Barnett Ave, and the main number is 703-432-0590. Bring ID, since staff check everyone at the front desk. Active-duty members can sign up for unmanned access after hours.
> 
> Want the weekend hours too? Details: [Fitness](https://quantico.usmc-mccs.org/recreation-fitness/fitness)

### 29. Do you allow pets?

**after**: not in that run (question added later)

**round3** (1.34s to first text, 2.85s total, 67 words)

> Yes, but only in a limited number. Inns of the Corps has a limited number of pet-friendly rooms, so ask for one when you book. The saved page doesn't list pet fees or rules (as of Oct 26, 2026). Call **703-630-4444** or the 24/7 reservation line at **1-888-409-7829** to check availability and costs.
> 
> Want details on how far ahead you can book? [Inns of the Corps Quantico](https://quantico.usmc-mccs.org/lodging/inns-of-the-corps)

### 30. How far ahead can I book?

**after**: not in that run (question added later)

**round3** (1.82s to first text, 3.52s total, 81 words)

> How far ahead you can book a tee time depends on your category (as of the saved page, Oct 26, 2026):
> 
> - **Active-duty military:** up to 10 days ahead
> - **Members:** 9 days
> - **Retired military, veterans, DoD:** 8 days
> - **General public:** 7 days
> 
> New online accounts start as General Public. Show your ID at the Pro Shop so they can move you to the right category. [Book online](https://www.chronogolf.com/club/medal-of-honor-golf-course) or see the [Golf Course page](https://quantico.usmc-mccs.org/recreation-fitness/recreation/outdoor-recreation/golf-course).
> 
> Want the current course hours?

### 31. How much is it to camp?

**after**: not in that run (question added later)

**round3** (2.85s to first text, 3.94s total, 55 words)

> Camping at Lunga Park is **$25 per night for a tent site** or **$40 per night for a rustic cabin**, with a two-night minimum for the cabin (as of Oct 26, 2026). Reservations are made in person at the Lunga Boathouse, first-come, first-served.
> 
> Want the Boathouse hours or the park's phone number? Details: [Lunga Park](https://quantico.usmc-mccs.org/recreation-fitness/recreation/outdoor-recreation/lunga-park)

### 32. How much are tickets?

**after**: not in that run (question added later)

**round3** (5.37s to first text, 6.62s total, 59 words)

> **Regular movies are $6.00 for adults (12+) and $4.00 for kids 6-11.** Children 0-5 are free. New releases cost a bit more: **$8.00 for adults and $6.00 for kids 6-11**, and kids 0-5 are still free (as of Oct 26, 2026).
> 
> You register on Eventbrite first and pay at the door. Want the showtimes or theater rules?
> 
> Details: [Movies](https://quantico.usmc-mccs.org/dining-entertainment/movies)

### 33. Anything to keep the kids busy this summer?

**after**: not in that run (question added later)

**round3** (2.72s to first text, 4.2s total, 67 words)

> For summer, the best options are **School Age Care seasonal camps** (ages 5-12) and **Youth Sports summer camps** (ages 5-14). The Base Library also runs a free summer reading program. As of Oct 26, 2026, no 2027 summer dates are posted.
> 
> - Youth Sports camps usually register mid-May to early August. Call 703-784-9756.
> - School Age Care camps: 703-784-2249.
> 
> Want the camp sports list? Details: [Youth Sports](https://quantico.usmc-mccs.org/recreation-fitness/recreation/sports/youth-sports)

