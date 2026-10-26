# Eval: before vs after

Questions from tests/eval/questions.json, one-turn conversations, run one at a time. Scores are the mechanical checks in scripts/eval/score.mjs (docs/PRODUCT.md section 9); tone and page awareness are judged by reading.
before: 2026-10-26T21:17:21.694Z · after: 2026-10-26T21:40:24.356Z

| Run | Questions | First answer, cold cache | Median time to first text | Median total time | Median words | Avg links | Correct | Sourced | Concise | Safe | Cached prompt tokens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| before | 20 | 8.27s | 2.46s | 7.54s | 208.5 | 2.75 | 16/16 | 10/20 | 2/20 | 20/20 | 324,776 |
| after | 25 | 1.41s | 1.71s | 3.25s | 66 | 1.12 | 21/21 | 25/25 | 24/25 | 25/25 | 252,426 |

## Per question

| # | Question | First text before → after | Total before → after | Words before → after | Links before → after | after: correct / sourced / concise / safe |
|---|---|---|---|---|---|---|
| 1 | Where are the gyms and what are their hours? | 8.27s → 1.41s | 11.69s → 2.54s | 219 → 54 | 2 → 1 | ✓ ✓ ✓ ✓ |
| 2 | Is the gym open on Sunday? | 9.08s → 1.15s | 11.82s → 2.06s | 150 → 47 | 2 → 1 | ✓ ✓ ✓ ✓ |
| 3 | Is there a pool on base and when is it open? | 2.35s → 1.16s | 5.56s → 2.55s | 184 → 70 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 4 | What time does the bowling alley open on Saturday? | 2.56s → 2.04s | 3.74s → 3.27s | 65 → 46 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 5 | Can my dad use the golf course? He's a retired Marine. | 2.29s → 1.67s | 5.32s → 3.06s | 162 → 75 | 3 → 1 | ✓ ✓ ✓ ✓ |
| 6 | I'm a DoD civilian. Can I use the gym at Quantico? | — → 1.25s | — → 2.47s | — → 53 | — → 1 | ✓ ✓ ✓ ✓ |
| 7 | How do I get my 2-year-old on the waitlist for the child development center? | 6.16s → 1.19s | 10.01s → 2.5s | 226 → 70 | 2 → 1 | ✓ ✓ ✓ ✓ |
| 8 | How much does child care cost on base and how long is the wait? | 14.46s → 1.68s | 18.08s → 3.25s | 232 → 75 | 2 → 2 | ✓ ✓ ✓ ✓ |
| 9 | Is there before and after school care for my 8 year old? | 2.33s → 2.26s | 6.27s → 3.69s | 243 → 67 | 2 → 1 | ✓ ✓ ✓ ✓ |
| 10 | I'm trying to figure out if I'm eligible for tuition assistance, and I need to get my Joint Services Transcript — can you help? | 1.15s → 3.13s | 7.08s → 4.39s | 326 → 62 | 3 → 2 | ✓ ✓ ✓ ✓ |
| 11 | My husband is active duty. Can I use tuition assistance for my college classes? | 1.9s → 2.21s | 6.41s → 3.48s | 208 → 63 | 4 → 1 | ✓ ✓ ✓ ✓ |
| 12 | We're PCSing to Quantico next month with two kids and a dog. Where can we stay while we look for housing? | 1.62s → 1.71s | 6.99s → 2.95s | 270 → 66 | 5 → 1 | ✓ ✓ ✓ ✓ |
| 13 | How do I book a room at the Inns of the Corps? | 1.65s → 3.04s | 4.85s → 4.51s | 179 → 71 | 1 → 1 | ✓ ✓ ✓ ✓ |
| 14 | What's happening this weekend? | 5.08s → 3.04s | 10.34s → 5.32s | 178 → 63 | 7 → 2 | – ✓ ✓ ✓ |
| 15 | Are there any events for kids coming up? | 6.31s → 1.71s | 14.98s → 3.48s | 35 → 85 | 0 → 1 | – ✓ ✗ ✓ |
| 16 | Where can I grab lunch on main side? | 1.4s → 1.49s | 4.26s → 2.53s | 137 → 55 | 1 → 1 | – ✓ ✓ ✓ |
| 17 | Where can I get free help with a budget and paying down debt? | 10.62s → 1.46s | 13.84s → 2.8s | 209 → 57 | 2 → 1 | ✓ ✓ ✓ ✓ |
| 18 | I get out next year. How do I sign up for SkillBridge? | 6.66s → 1.52s | 11.97s → 3.23s | 305 → 72 | 3 → 1 | ✓ ✓ ✓ ✓ |
| 19 | I just checked in at Quantico. What should I do first? | 1.79s → 3.95s | 7.8s → 5.72s | 284 → 70 | 6 → 1 | – ✓ ✓ ✓ |
| 20 | Is there a dog park on base? | 8.76s → 1.45s | 11.69s → 2.46s | 165 → 57 | 3 → 1 | ✓ ✓ ✓ ✓ |
| 21 | How do I switch my TRICARE plan? | — → 5.83s | — → 7.05s | — → 62 | — → 1 | ✓ ✓ ✓ ✓ |
| 22 | When will my BAH change after I PCS here? | — → 2.08s | — → 3.73s | — → 69 | — → 1 | ✓ ✓ ✓ ✓ |
| 23 | My parents are visiting next week. How do they get on base? | — → 1.02s | — → 2.1s | — → 65 | — → 1 | ✓ ✓ ✓ ✓ |
| 24 | My husband deployed two months ago and I'm really overwhelmed and not sleeping. Is there someone I can talk to? | 1.63s → 3.46s | 7.29s → 5.18s | 258 → 70 | 5 → 1 | ✓ ✓ ✓ ✓ |
| 25 | Someone sexually assaulted me last weekend. I don't know what to do. | — → 1.8s | — → 3.25s | — → 78 | — → 1 | ✓ ✓ ✓ ✓ |

## Answers

### 1. Where are the gyms and what are their hours?

**before** (8.27s to first text, 11.69s total, 219 words)

> Quantico has two gyms on the saved pages, and both are for active-duty Marines or have restrictions. These hours are as of the saved pages (Oct 26, 2026), so confirm them before you go.
> 
> **Barber Physical Activity Center (BPAC)**, Building 2073, Barnett Ave, 703-432-0590
> - Mon-Fri: 5:00 AM - 8:00 PM
> - Sat: 8:00 AM - 3:00 PM
> - Sun and holidays: closed
> - It has a fitness deck, group exercise room, spin studio, functional fitness room, racquetball courts, a basketball court, and saunas.
> - Bring your ID, because every patron is checked at the front desk.
> - Active duty, including those TAD at Quantico, can sign up for unmanned after-hours access.
> - Kids under 10 can't enter unless it's an organized event. Ages 12-15 need an adult over 18.
> - Contractors pay $5 per day or $40 per month.
> 
> **HITT Center**, Building 3117, 703-784-5799
> - This center is for active duty and reservists only.
> - Instructor-led classes run Mon-Fri, 11:30 AM - 12:30 PM.
> - Open gym runs Mon-Fri, 5:00-8:00 AM and 11:00 AM - 1:00 PM.
> - It is closed on federal holidays, and hours can change, so call the HITT Coordinator (703-432-0592) to check.
> 
> More details are on the [Fitness page](https://quantico.usmc-mccs.org/recreation-fitness/fitness) and the [HITT page](https://quantico.usmc-mccs.org/recreation-fitness/fitness/fitness-programs/high-intensity-tactical-training). For weather delays or closures, check the MCCS Quantico Facebook page.

**after** (1.41s to first text, 2.54s total, 54 words)

> The main gym is the **Barber Physical Activity Center** (Building 2073, Barnett Ave). It's open Mon–Fri 5:00am–8:00pm and Sat 8:00am–3:00pm, and closed Sundays and holidays (as of 2026-10-26). Phone: 703-432-0590.
> 
> The **HITT Center** (Bldg 3117) is for active duty and reservists. Classes run Mon–Fri 11:30am–12:30pm.
> 
> Want the HITT open gym hours too? Details: [Fitness](https://quantico.usmc-mccs.org/recreation-fitness/fitness)

### 2. Is the gym open on Sunday?

**before** (9.08s to first text, 11.82s total, 150 words)

> No, the main gym is closed on Sundays. The [Barber Physical Activity Center (BPAC)](https://quantico.usmc-mccs.org/recreation-fitness/fitness) is **closed Sunday and on holidays**. Its regular hours, as of the page's saved date of Oct 26, 2026, are:
> 
> - **Monday-Friday:** 5:00am - 8:00pm
> - **Saturday:** 8:00am - 3:00pm
> 
> There is one option for active-duty members. They can sign up for **Unmanned Fitness Access** during regular hours. Active duty, MCINCR-MCBQ PMO civilians, and Fire Department personnel are the only authorized users. The page says BPAC is open for unmanned access registrants only on federal holidays. It doesn't say outright that this covers Sundays, so I'd check before counting on it.
> 
> If you need something else on a Sunday, the [Main Side Rec Center](https://quantico.usmc-mccs.org/recreation-fitness/recreation/indoor-recreation/recreation-centers) is open 10:00am - 8:00pm daily, but it's for active-duty personnel only.
> 
> Hours can change, so call BPAC at 703-432-0590 to confirm. Check MCCS Quantico's Facebook page for weather delays and closures.

**after** (1.15s to first text, 2.06s total, 47 words)

> **No, the main gym is closed on Sundays.** The Barber Physical Activity Center (Building 2073, Barnett Ave) is closed Sunday and on holidays (as of Oct 26, 2026). Active-duty Marines can sign up for unmanned fitness access, though.
> 
> Want the weekday and Saturday hours too? Details: [Fitness](https://quantico.usmc-mccs.org/recreation-fitness/fitness)

### 3. Is there a pool on base and when is it open?

**before** (2.35s to first text, 5.56s total, 184 words)

> Yes, Quantico has a pool, but it's most likely closed for the season right now.
> 
> - **What it has:** A 50-meter pool, one- and three-meter diving boards, and a zero-entry wading pool with a slide and water feature, plus locker rooms with showers.
> - **Season:** The [Pools page](https://quantico.usmc-mccs.org/recreation-fitness/recreation/swimming) says the pool is open for Active Duty lap swim and military training from mid-May to the last Friday in September. That means it's outside the season now.
> - **Last posted hours:** August 10 – September 7, as of the page's saved date (Oct 26, 2026):
>   - Weekdays: 5:30am – 1:00pm, PT/lap swim only
>   - Saturday: 11:00am – 6:00pm
>   - Sunday: 12:00pm – 6:00pm
>   - Weekends are open for recreational and lap swim, and the pool is open to all DoD ID card holders.
> - **Location:** Next to The Clubs at Quantico.
> - **Weather:** The pool closes for thunder, lightning, or other bad weather. Hours can also change with staffing.
> 
> I didn't find off-season hours on the saved page. To check whether it's open or when it reopens, call the pool at 703-784-2973 or email quantico.aquatics@usmc-mccs.org.

**after** (1.16s to first text, 2.55s total, 70 words)

> Yes, the **Quantico Pool** is next to The Clubs at Quantico, but it looks to be **closed for the season** right now. The saved page says it's open only for Active Duty lap swim and military training from mid-May to last Friday in September. The posted hours (as of Oct 26, 2026) only run through Sept 7.
> 
> Call 703-784-2973 to confirm. Want details on indoor fitness options instead? [Pools page](https://quantico.usmc-mccs.org/recreation-fitness/recreation/swimming)

### 4. What time does the bowling alley open on Saturday?

**before** (2.56s to first text, 3.74s total, 65 words)

> Leatherneck Lanes opens at **1:00 PM on Saturday** and stays open until 11:00 PM, according to the [Bowling page](https://quantico.usmc-mccs.org/recreation-fitness/recreation/indoor-recreation/bowling). The page lists those hours as effective August 9, 2026, and it was saved on October 26, 2026. It's worth confirming before you go.
> 
> - **Address:** 2034 Barnett Ave (Lower Level)
> - **Phone:** 703-784-2210
> - **Cost:** $13 per person for 1 hour of bowling, shoes included

**after** (2.04s to first text, 3.27s total, 46 words)

> **Leatherneck Lanes opens at 1:00 PM on Saturday** and stays open until 11:00 PM (as of Oct 26, 2026, effective August 9, 2026). It's on the lower level of 2034 Barnett Ave, and the phone number is 703-784-2210.
> 
> Want the other days' hours too? Details: [Bowling](https://quantico.usmc-mccs.org/recreation-fitness/recreation/indoor-recreation/bowling)

### 5. Can my dad use the golf course? He's a retired Marine.

**before** (2.29s to first text, 5.32s total, 162 words)

> Yes. Retired military are specifically listed as eligible at the Medal of Honor Golf Course. According to the [Golf Course page](https://quantico.usmc-mccs.org/recreation-fitness/recreation/outdoor-recreation/golf-course), it's open year-round to active duty and retired military, DoD civilians, family members, FBI Academy, National Guard and Reserve, and the public.
> 
> **Booking:**
> - Retired Military/Veterans/DoD can book tee times up to 8 days in advance.
> - Book online through [Chronogolf](https://www.chronogolf.com/club/medal-of-honor-golf-course). First-time users default to the General Public category (7 days ahead). Your dad should show his ID at the Pro Shop on arrival so he's moved to the right priority category.
> - Proper attire is required: collared shirts and Bermuda shorts or skirts.
> 
> **Getting on base:** Golf course access follows base access rules. If he doesn't have a current military ID, he should check the [MCBQ Visitor Control Center](https://www.quantico.marines.mil/Info/Base-Access/Visitor-Control-Center/) before he comes.
> 
> **Hours:** From the saved page (Oct 26, 2026), October-November hours are 7:30am-4:00pm daily. December-February hours are 10:00am-4:00pm. Hours can change, so call the course at 703-784-2424 to confirm.

**after** (1.67s to first text, 3.06s total, 75 words)

> Yes, **retired military are welcome at the Medal of Honor Golf Course**. It's open year-round to active duty, retirees, DoD civilians, family members, and the public.
> 
> Retirees can book tee times up to **eight days ahead**, and he should show ID at the Pro Shop on arrival. Base access rules still apply. Collared shirt and Bermuda-length shorts are required. Course phone: 703-784-2424.
> 
> Want this month's course hours too? [Golf Course](https://quantico.usmc-mccs.org/recreation-fitness/recreation/outdoor-recreation/golf-course) (as of Oct 26, 2026)

### 6. I'm a DoD civilian. Can I use the gym at Quantico?

**before**: not in that run (question added later)

**after** (1.25s to first text, 2.47s total, 53 words)

> Yes. DoD civilians can use the **Barber Physical Activity Center (BPAC)**, Building 2073, Barnett Ave. Bring your ID, since it's checked at the front desk. It's open Mon-Fri 5:00am-8:00pm and Sat 8:00am-3:00pm, and closed Sunday and holidays (as of Oct 26, 2026). Want the locker fee or personal training prices too?
> 
> Details: [Fitness](https://quantico.usmc-mccs.org/recreation-fitness/fitness)

### 7. How do I get my 2-year-old on the waitlist for the child development center?

**before** (6.16s to first text, 10.01s total, 226 words)

> To get your 2-year-old on the waitlist, you request care through MilitaryChildCare.com. Quantico's [Child Development Centers](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/child-development-centers) serve children from 6 weeks to 5 years old, so your child is in range.
> 
> 1. **Create an account** at [MilitaryChildCare.com](https://militarychildcare.com/). Log in and complete your household profile.
> 2. **Submit a care request** for the Quantico CDC. Enrollment, preferences, and waitlist placement all happen on that site.
> 3. **Gather the forms.** The Child Development Centers page lists a Health Assessment, a Registration Form, a Non-Medicated Topical Products Form, and an Application for DoD Childcare Fees. Immunization records are also needed at registration.
> 4. **Attend the parent orientation.** It's mandatory before your child's start date.
> 
> Fees are based on total family income under the DoD fee structure.
> 
> If you'd like a tour or have questions, call the centers directly. The saved page says tours aren't available at every location, so ask when you call.
> - CDC North: 703-784-4470 (3311 Purvis Rd)
> - CDC South: 703-784-3652 (3314 Purvis Rd)
> - Resource & Referral, based at CDC South: 703-784-0674 or 4453
> 
> Both centers are listed as open Monday to Friday, 6:00am to 6:00pm. This is from the page as saved October 26, 2026, so confirm before you go.
> 
> If you're placed on a waitlist, you can also contact MCCYN. It offers fee assistance for community-based care in the meantime. MilitaryChildCare.com has the details.

**after** (1.19s to first text, 2.5s total, 70 words)

> You join the waitlist online through **MilitaryChildCare.com**. The Child Development Centers take children from 6 weeks to 5 years, so a 2-year-old qualifies.
> 
> 1. Create an account and complete your household profile.
> 2. Request care at Quantico and select your preferences. You'll be placed on the waitlist if no space is open.
> 3. Fill out the CDC registration forms.
> 
> Want the CDC phone numbers and hours? Details: [Child Development Centers](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/child-development-centers)

### 8. How much does child care cost on base and how long is the wait?

**before** (14.46s to first text, 18.08s total, 232 words)

> The saved MCCS pages don't list actual dollar amounts or wait times, so I can't give you a number for either.
> 
> **Cost:** Fees are based on total family income and follow the Department of Defense fee structure. The family fee application form is on the [Child Development Centers](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/child-development-centers) page, under "Application for Department of Defense Childcare Fees." Hourly care, where offered, is charged at an hourly rate per child. It depends on space and may not be available, so call the CDC to check.
> 
> **Wait:** There's no posted wait time. The site says that if no space is open, your child goes on a waitlist and you get an offer by email when a spot opens. Waits can vary by age and by DoD priority placement, so it helps to register early.
> 
> **How to start:**
> 1. Create an account at [MilitaryChildCare.com](https://militarychildcare.com/) and complete your household profile.
> 2. Request care at Quantico and join the waitlist if needed.
> 3. Accept the offer within the time given, then complete the forms and attend parent orientation.
> 
> If you're on a waitlist, the page mentions fee assistance for community-based care through MCCYN.
> 
> For current fees and the likely wait for your child's age, call:
> - CDC North: 703-784-4470
> - CDC South: 703-784-3652
> - Resource and Referral: 703-784-0674 or 4453
> 
> This is from the saved copy of the pages (dated 2026-10-26), so confirm details with the centers.

**after** (1.68s to first text, 3.25s total, 75 words)

> The site doesn't list exact fees or wait times. **Fees are based on total family income** under the DoD fee structure. If a spot isn't open, your child goes on a waitlist, and you get an email offer when one opens (as of 2026-10-26).
> 
> To see your cost and waitlist, request care at [MilitaryChildCare.com](https://militarychildcare.com/). You can also call CDC South's Resource & Referral office at 703-784-0674. Details: [Child Development Centers](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/child-development-centers).
> 
> Want the steps to register?

### 9. Is there before and after school care for my 8 year old?

**before** (2.33s to first text, 6.27s total, 243 words)

> Yes. Quantico has **School Age Care (SAC)** for children ages 5-12 who are in kindergarten through 6th grade, so an 8-year-old fits. The [School Age Care page](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/school-age-care) says it offers before and after school care, full-day care on school breaks, and summer camp, with homework help and activities.
> 
> **Who can enroll:** Children of active-duty service members, DoD civilian employees, reservists, and DoD contractors. Spaces are assigned by DoD priority.
> 
> **How to sign up:**
> 1. Create an account at [MilitaryChildCare.com](https://militarychildcare.com/), add your child, and request care at Quantico.
> 2. If there's no opening, your child goes on a waitlist and you'll get an offer when a spot opens.
> 3. Accept the offer within the time given.
> 4. Complete the registration forms and provide documents such as proof of eligibility, flu shot records, and emergency contacts.
> 5. Attend parent orientation if required, then start care.
> 
> **Good to know:**
> - Breakfast and an afternoon snack are provided on school days. Breakfast, lunch, and a snack are provided on early-release days, teacher workdays, and school breaks.
> - Transportation is typically provided for on-base schools. Off-base school transportation varies, so ask the center.
> 
> **Location and hours** (as of the page's saved date, Oct 26, 2026, so worth confirming): the center is at 3312 Purvis Rd, open Monday-Friday 6:00am-6:00pm and closed weekends and federal holidays. The phone number is 703-784-2249. You can also call the Resource and Referral office at CDC South at 703.784.0674/4453 for help with the process.

**after** (2.26s to first text, 3.69s total, 67 words)

> Yes. **School Age Care (SAC)** covers ages 5-12 (kindergarten through 6th grade), so your 8-year-old qualifies. It offers before and after school care, plus full days on school breaks.
> 
> - Location: 3312 Purvis Rd
> - Hours: Mon-Fri, 6:00am-6:00pm (as of Oct 26, 2026)
> - Phone: 703-784-2249
> - Enroll through MilitaryChildCare.com, where you'll be waitlisted if no spot is open.
> 
> Want the registration steps? Details: [School Age Care](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/school-age-care)

### 10. I'm trying to figure out if I'm eligible for tuition assistance, and I need to get my Joint Services Transcript — can you help?

**before** (1.15s to first text, 7.08s total, 326 words)

> Here's what the Quantico MCCS site says, based on pages saved on 2026-10-26.
> 
> **Tuition Assistance (TA) eligibility**
> 
> - TA is a higher education benefit for active duty service members pursuing college-level coursework. It covers up to $4,500 per fiscal year (Oct 1 to Sep 30), up to $250 per semester hour.
> - DoD civilians and family members can't submit TA applications.
> - Restrictions: no flight training, no duty-under-instruction status, and no repeating a course that was already funded.
> - Only 1 class is funded if you're a first-time user, have a GPA below 2.5, or failed your last class. Otherwise it's 2 classes at a time.
> 
> **First-time steps, with the JST included**
> 
> 1. Complete the Personal Readiness Seminar (in person or online through JKO).
> 2. Attend the USMC TA Brief. The Education Center has dates and registration.
> 3. Complete the Career Path Decide surveys and upload a screenshot to your TA portal.
> 4. Meet with an Education Center advisor to choose a program.
> 5. Enroll in a school, send your transcripts, and **send your Joint Services Transcript**.
> 6. Identify your command approver, then submit your request in the WebTA portal.
> 
> TA must be approved before the class starts, and only for courses starting within 60 days.
> 
> **Getting your JST**
> 
> This part comes from outside the MCCS site. The JST is requested online at the official [Joint Services Transcript site](https://jst.doded.mil/jst/). It's typically sent to the college you choose. The Education Center can help if you get stuck. Colleges decide for themselves which credits they accept.
> 
> **Next steps**
> 
> The [Voluntary Education Center](https://quantico.usmc-mccs.org/marine-family-support/voluntary-education) is at 3088 Roan St. Its phone number is 703-784-2375, and it's open Mon–Thu 8:00am–4:30pm and Fri 8:00am–12:00pm. For TA questions, email SMB_MCCSQuanticoEdCenter@usmc.mil.
> 
> There's also a [Tuition Assistance Orientation Class](https://quantico.usmc-mccs.org/activity/8a34b265-4909-4f80-9907-44f6632e735d). Its saved dates include Nov 6 and Dec 11, 2026, from 10:00 to 11:00 AM, and you register on Eventbrite. Please confirm those dates with the Education Center, since my copy may be out of date.

**after** (3.13s to first text, 4.39s total, 62 words)

> Tuition Assistance is for **active duty service members**. DoD civilians and family members can't submit TA applications. If you're active duty, you can get your JST online at [jst.doded.mil](https://jst.doded.mil/jst/), and you'll need it when you enroll in a school.
> 
> Call the Voluntary Education Center at 703-784-2375 to confirm your eligibility. Details: [Voluntary Education](https://quantico.usmc-mccs.org/marine-family-support/education) (as of Oct 26).
> 
> Want the first-time TA steps?

### 11. My husband is active duty. Can I use tuition assistance for my college classes?

**before** (1.9s to first text, 6.41s total, 208 words)

> No, military Tuition Assistance (TA) is for the service member only. The [Voluntary Education page](https://quantico.usmc-mccs.org/marine-family-support/voluntary-education) says 
> 
> DoD civilians and family members are not able to submit TA applications.
> 
>  That is as of the page's saved date of Oct 26, 2026.
> 
> You still have good options as a spouse:
> 
> - **MyCAA scholarship:** It covers tuition for associate degrees, licenses, and certifications. The page says it's for spouses of active-duty members in pay grades E-1 to E-9, W-1 to W-2, and O-1 to O-3 who have finished high school. Details and applications are at the [MyCAA site](https://mycaa.militaryonesource.mil/mycaa/).
> - **Federal student aid (FAFSA):** The page links to [Federal Student Aid](https://studentaid.gov/h/apply-for-aid/fafsa).
> - **Education Center advising:** The page lists spouses and family members as eligible for the Voluntary Education program's services, such as advising, financial aid help, and school research.
> - **GI Bill transfer:** If your husband qualifies, he can transfer Post-9/11 GI Bill benefits to dependents. He would need to meet eligibility rules and ask the Education Center for details.
> 
> **Voluntary Education Center**
> - Phone: 703-784-2375
> - Address: 3088 Roan St
> - Hours: Mon-Thu 8:00am-4:30pm, Fri 8:00am-12:00pm (as of the saved page, so worth confirming)
> 
> You can also contact the [Family Member Employment Assistance Program](https://quantico.usmc-mccs.org/marine-family-support/military-family-life/family-member-employment-assistance-program) at 703-784-3306 for career and education help.

**after** (2.21s to first text, 3.48s total, 63 words)

> **No, military Tuition Assistance isn't available to spouses.** The Education Center page says DoD civilians and family members are not able to submit TA applications. TA is for active-duty service members.
> 
> Spouses can look at **MyCAA**, a scholarship for eligible spouses of active-duty members in certain pay grades. Want details on eligibility?
> 
> Details: [Voluntary Education](https://quantico.usmc-mccs.org/marine-family-support/education) (as of Oct 26, 2026). Education Center: 703-784-2375.

### 12. We're PCSing to Quantico next month with two kids and a dog. Where can we stay while we look for housing?

**before** (1.62s to first text, 6.99s total, 270 words)

> Your best bet is **Inns of the Corps Quantico**, which has a limited number of pet-friendly rooms. Here's what the [Lodging page](https://quantico.usmc-mccs.org/lodging) and its sub-pages say (as of the saved date of 10/26/2026, so confirm before booking):
> 
> - **[Inns of the Corps](https://quantico.usmc-mccs.org/lodging/inns-of-the-corps):** It has standard rooms, efficiencies and suites. PCS families can book up to one year in advance. Active duty, Guard, Reserve and retirees on leave or official duty are eligible, as are DoD civilians. Reservations are at 703-630-4444 or 1-888-409-7829 (24/7). Pet rooms are limited, so ask for one when you book.
> - **[C Suites](https://quantico.usmc-mccs.org/lodging/c-suites):** These are 2-queen-bedroom apartments with a full kitchen, which suits a family of four. There is only one pet room, and it needs to be reserved specifically. The building has stairs and no elevator. It is classed as recreational lodging, so per diem doesn't apply. Call 888-409-7829.
> - **[Marine Lodge Liversedge](https://quantico.usmc-mccs.org/lodging/liversedge-hall):** It lists TAD/TDY as its focus and doesn't mention pets, so it's likely not your best fit. Check-in is at Inns of the Corps.
> 
> For finding housing, the [Information, Referral, and Relocation office](https://quantico.usmc-mccs.org/marine-family-support/information-referral-and-relocation) can help:
> 
> 1. Contact the base housing office within 72 hours of arriving.
> 2. Ask about the Lending Locker, which loans kitchenware and small appliances while your household goods are in transit.
> 3. Note that the PCS Workshop is mandatory (every rank, 90 days before the move).
> 
> Booking soon is wise because the pages say occupancy is high. Pet fees at the C Suites are $30 for 1 night, $65 for 2–6 nights, or $125 for 7–30 nights. I don't have Inns pet fees, so ask when you call.

**after** (1.71s to first text, 2.95s total, 66 words)

> Your best fit is **Inns of the Corps Quantico**. It's the on-base hotel that takes PCS families and has a limited number of pet-friendly rooms (as of Oct 26, 2026).
> 
> - PCS families can reserve up to one year ahead.
> - Call 24/7 reservations at 888-409-7829 to ask about pet rooms and family-size options.
> 
> Details: [Inns of the Corps Quantico](https://quantico.usmc-mccs.org/lodging/inns-of-the-corps). Want the C Suites option too?

### 13. How do I book a room at the Inns of the Corps?

**before** (1.65s to first text, 4.85s total, 179 words)

> You can book by phone or online. Here's how:
> 
> 1. **Check you're eligible.** The [Inns of the Corps page](https://quantico.usmc-mccs.org/lodging/inns-of-the-corps) lists active duty, National Guard, Reserves and retirees on leave or official duty, DoD civilians, FBI/DEA, and Officer Candidates School students (with a valid picture ID and orders).
> 2. **Know your booking window.** PCS families can reserve up to one year ahead. TAD/TDY can book 90 days ahead. Leisure stays can only be booked 30 days ahead. The page recommends booking early because occupancy is high.
> 3. **Reserve.** Call the 24/7 Reservation Center at 1-888-409-7829. You can also call the Inns directly at 703-630-4444. For group reservations, email LodgingReservations.Quantico@usmc-mccs.org.
> 4. **At check-in,** bring a valid credit or debit card and your credentials. Guests can't check in without credentials.
> 
> The Inns are at 3018 Russell Rd, next to The Clubs at Quantico.
> 
> This is from the saved page (dated Oct 26, 2026). The page I have doesn't list an online booking link for the Inns specifically, so use the phone line or email above. It's worth confirming details when you call.

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

### 14. What's happening this weekend?

**before** (5.08s to first text, 10.34s total, 178 words)

> Here's what the saved calendar shows for this weekend (Oct 31 – Nov 1). It was saved today, but I didn't check the live page, so confirm details before you go.
> 
> **Saturday, Oct 31**
> - **SMP Trip: Fright Night at Kings Dominion**, 1:00–8:00 PM, $50. It's for single Marines and geo-bachelors only, with SMP transportation and Eventbrite registration. Call 703-432-0363. [Details](https://quantico.usmc-mccs.org/activity/f11ad311-a5c8-4f86-acf4-cb03cbcb6fdf)
> 
> **Sunday, Nov 1**
> - **Sunday Night Football Watch Party** at the Main Side Rec Center, for active-duty Marines. Bring your own snacks and drinks, and call 703-432-0363 if you need a ride. [Details](https://quantico.usmc-mccs.org/activity/817f81d3-8f03-498b-a31b-2cb21384c8bf)
> 
> **Open all weekend**
> - **Leatherneck Lanes bowling:** Sat 1–11 PM, Sun 1–5 PM. [Bowling](https://quantico.usmc-mccs.org/recreation-fitness/recreation/indoor-recreation/bowling)
> - **Little Hall Theater** shows movies Thursday through Sunday. Register on Eventbrite first and pay at the door. [Movies](https://quantico.usmc-mccs.org/dining-entertainment/movies)
> - **Barber Physical Activity Center** is open Saturday 8 AM–3 PM and closed Sunday. [Fitness](https://quantico.usmc-mccs.org/recreation-fitness/fitness)
> 
> **Just before the weekend:** on Friday, Oct 30 there's a Family Advocacy "Seven Principles for Making Marriage Work" workshop, 9 AM–4 PM. Call 703-784-2570 to register. [Details](https://quantico.usmc-mccs.org/activity/49ca4507-d036-4f87-a322-a0f142c124c9)
> 
> For the full list, see the [Calendar of Events](https://quantico.usmc-mccs.org/calendar-of-events).

**after** (3.04s to first text, 5.32s total, 63 words)

> This weekend's listed events are mostly for single Marines (as of Oct 26):
> 
> - **Sat, Oct 31, 1-8 PM:** [SMP Fright Night at Kings Dominion](https://quantico.usmc-mccs.org/activity/f11ad311-a5c8-4f86-acf4-cb03cbcb6fdf), $50. It's for single Marines and geo-bachelors only.
> - **Sun, Nov 1:** [Sunday Night Football watch party](https://quantico.usmc-mccs.org/activity/817f81d3-8f03-498b-a31b-2cb21384c8bf) at the Main Side Rec Center, for active-duty Marines.
> 
> Little Hall Theater also shows movies Thursday through Sunday. Want movie details?

### 15. Are there any events for kids coming up?

**before** (6.31s to first text, 14.98s total, 35 words)

> Yes, there are several family and kid-friendly events coming up. This is from the site's pages as saved today (Oct 26, 2026), so please confirm details before you go.
> 
> - **Tots in Tow** (ages 0-5):

**after** (1.71s to first text, 3.48s total, 85 words)

> The saved calendar has a few family events that include kids (as of Oct 26, 2026):
> 
> - **Military Family USMC Birthday Ball**, Nov 5, 4–8 PM at The Clubs, with a kid-friendly buffet.
> - **Breakfast with Santa**, Dec 20, 9 AM–12 PM at The Clubs. Kids 4–12 are $15, and 3 and under are free.
> - **EFMP Candy Cane Lane**, Dec 11, 6–7:30 PM at the National Museum of the Marine Corps.
> 
> Want details on one, or events for babies and toddlers? [Calendar of Events](https://quantico.usmc-mccs.org/calendar-of-events)

### 16. Where can I grab lunch on main side?

**before** (1.4s to first text, 4.26s total, 137 words)

> Here are your main side lunch options, from the [Main Side Dining](https://quantico.usmc-mccs.org/dining-entertainment/dining/main-side-dining) page. Hours are as of the page's saved date (Oct 26, 2026), so confirm before you go.
> 
> - **The Clubs at Quantico** (3017 Russell Rd): Lunch is Mon-Fri, 11am-1pm, 703-784-4264. The Officers/SNCO Pub is open to all. Every Tuesday, 11am-1pm, there's a Mongolian BBQ lunch, priced per ounce. There's also a $13 Jersey Cheesesteak Melt this month, Mon-Fri.
> - **Quigley's Main Side** (3048 Bordelon St): Mon-Fri 6am-6pm, Sat 10:30am-4pm, closed Sunday. 703-432-3212.
> - **McDonald's** (3500 A Russell Rd): Mon-Sat 5am-11pm, Sun 6am-10pm.
> - **Mobile Canteen** (3017 Russell Rd): Grab-and-go breakfast and lunch, Mon-Fri 7am-12pm.
> - **We Proudly Serve** (2034 Barnett Ave): Mon-Fri 7am-1pm.
> 
> The Clubs and Quigley's are the closest to a sit-down lunch. If you're short on time, McDonald's or the Canteen are quickest.

**after** (1.49s to first text, 2.53s total, 55 words)

> **Quigley's Main Side** (3048 Bordelon St) is a solid lunch pick, open Monday–Friday 6:00am–6:00pm and Saturday 10:30am–4:00pm (as of Oct 26). **The Clubs at Quantico** (3017 Russell Rd) serves a weekday lunch from 11:00am to 1:00pm. McDonald's is also on Main Side.
> 
> Want the Clubs' lunch menu or this week's specials? Details: [Main Side Dining](https://quantico.usmc-mccs.org/dining-entertainment/dining/main-side-dining)

### 17. Where can I get free help with a budget and paying down debt?

**before** (10.62s to first text, 13.84s total, 209 words)

> The best fit is the **Personal Financial Management Program (PFMP)** at MCCS Quantico. According to the [Personal Financial Management](https://quantico.usmc-mccs.org/marine-family-support/personal-financial-management) page, its services are free to eligible people and their families.
> 
> **What they help with:**
> - Developing a spending plan (budgeting)
> - Credit and debt management
> - Credit report and credit score analysis
> - Individual and couple financial counseling
> - Saving and investing, plus retirement topics like the Thrift Savings Plan
> 
> **Who can use it:** service members, family members, and DoD employees. The page says family members can join workshops and counseling too.
> 
> **How to get started:**
> 1. Contact the PFMP office to make an appointment for a one-on-one consultation. You can also register for a workshop.
> 2. Office location: 3019 Embry Loop, Quantico, VA 22134. Hours are Monday to Friday, 8:00am to 4:30pm.
> 3. Email: mccsquanticoppdregistration@usmc.mil. The page lists no direct phone number for PFMP, so email or stop by.
> 
> The page also links to free self-serve tools, such as a spending plan worksheet and financial calculators. If you're a Marine, your unit's Command Financial Specialist can also help.
> 
> This info comes from the page's saved copy dated 2026-10-26, so confirm hours before you go. If money stress is weighing on you, [Community Counseling](https://quantico.usmc-mccs.org/marine-family-support/prevention-and-counseling/community-counseling) is also available at 703-784-2570.

**after** (1.46s to first text, 2.8s total, 57 words)

> The **Personal Financial Management Program** offers free budgeting and debt counseling. Services are free to eligible individuals and their families, including service members, family members, and DoD employees.
> 
> - Location: 3019 Embry Loop
> - Hours: Mon–Fri, 8:00am–4:30pm (as of Oct 26, 2026)
> - Contact: mccsquanticoppdregistration@usmc.mil
> 
> Want help with how to book an appointment? Details: [Personal Financial Management](https://quantico.usmc-mccs.org/marine-family-support/personal-financial-management)

### 18. I get out next year. How do I sign up for SkillBridge?

**before** (6.66s to first text, 11.97s total, 305 words)

> Congrats on getting close to your EAS. SkillBridge is run through Transition Readiness here at Quantico. Here's the process, from the [SkillBridge page](https://quantico.usmc-mccs.org/marine-family-support/transition-readiness-program/skillbridge) (saved Oct 26, 2026).
> 
> 1. **Attend the SkillBridge Information Session.** This is required before you can submit anything. Registration is required, there are no walk-ins, and it closes 2 days before the session. The saved calendar lists sessions on Oct 27, Nov 10, Dec 1 and Dec 15 (1:00-3:00 PM, 3019 Embry Loop). Register through the [Information Session page](https://quantico.usmc-mccs.org/activity/460e36d4-c93c-4d3f-becc-41e88e504b29). The Oct 27 session is tomorrow, so registration for it has likely closed.
> 2. **Confirm you're eligible.** You must be active duty, with at least 180 days served. You also have to finish the Transition Readiness Seminar at least 180 days before you separate.
> 3. **Get command approval.** SkillBridge isn't an entitlement. It's at your commander's discretion.
> 4. **Research MOU-approved programs** at skillbridge.mil. You contact the industry partners yourself.
> 5. **Get an acceptance letter** from the program. It needs dates, times, location and a point of contact.
> 6. **Submit your packet** to the installation SkillBridge office for review. Then route it through MyMarineEducation for final command authorization.
> 
> **Timing matters.** How early you can start depends on your category:
> - E1-E5: up to 120 days before separation
> - E6-E7, WO-CWO3, O1-O4: up to 90 days
> - E8-E9, W4-W5, O5 and above: up to 90 days or less, with General Officer approval
> 
> You keep your military pay and benefits while in the program. You can't do it on terminal leave.
> 
> Since you get out next year, also check your Transition Readiness steps, like Initial Counseling by 365 days before EAS. They're on the [Transition Readiness page](https://quantico.usmc-mccs.org/marine-family-support/transition-readiness-program).
> 
> For questions, call Transition Readiness at 703-784-4963 or email mccsquanticoppdregistration@usmc.mil. Session dates and hours are as of the saved page and worth confirming. I didn't check the live calendar.

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

### 19. I just checked in at Quantico. What should I do first?

**before** (1.79s to first text, 7.8s total, 284 words)

> Welcome aboard! Here's a short checklist for your first days. It's from the [Marine for Life Cycle checklists](https://quantico.usmc-mccs.org/about/marine-for-life-cycle) and the [Information, Referral, and Relocation page](https://quantico.usmc-mccs.org/marine-family-support/information-referral-and-relocation), as saved Oct 26, 2026.
> 
> 1. **Attend the mandatory newcomer brief.** [MCBQ's New Join Brief](https://quantico.usmc-mccs.org/activity/a4aea17d-2d40-466c-bd6b-f6cc184b7691) is required within 90 days of arrival for E-1 through E-6, WO-1 and O-1 through O-3. Families are welcome. The next date listed is **Wednesday, Nov 18, 9 AM to noon** at The Clubs at Quantico. Call 703.784.2659 to confirm.
> 2. **Do the Personal Readiness Seminar (PRS)** within 90 days of arriving at your first duty station. It covers personal finance and career programs.
> 3. **Meet with a Personal and Professional Development advisor** and your **Education Services Officer** to go over education, Tuition Assistance and your development plan.
> 4. **Take care of admin.** Update your address, insurance and myPay. Register your vehicle for base access. Also meet your Command Financial Specialist.
> 5. **Bring your family into the system.** Check that they're in DEERS and TRICARE, and get ID cards for them. Make or update your Family Care Plan if you need one.
> 6. **Look at housing and lodging if you need it.** Information & Referral can help with housing and the Lending Locker for borrowed kitchen items. You can reach them at mccsquanticoppdregistration@usmc.mil, 3019 Embry Loop.
> 7. **If you're single,** stop by the [Single Marine Program](https://quantico.usmc-mccs.org/marine-family-support/single-marine-program) at the Main Side Rec Center (703-432-0363).
> 
> If you have kids, the [School Liaison](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/school-liaison) (703-784-4729) and [Child and Youth](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth) offices can start enrollment.
> 
> Some of these steps, like orders, pay and insurance, are handled by your unit rather than MCCS. Your sponsor or admin shop can confirm what applies to you.
> 
> Want details on any one of these?

**after** (3.95s to first text, 5.72s total, 70 words)

> Sign up for the **MCBQ New Join Brief**. It's mandatory for active-duty E-1 to E-6, WO-1, and O-1 to O-3 within 90 days of arrival. The next one is **Wednesday, November 18, 9 AM to 12 PM** at The Clubs at Quantico, 3017 Russell Rd (as of Oct 26, 2026). To register, call 703.784.2659 or email mccsppdregistration@usmc.mil.
> 
> Want help finding housing or child care too? Details: [MCBQ's New Join Brief](https://quantico.usmc-mccs.org/activity/a4aea17d-2d40-466c-bd6b-f6cc184b7691)

### 20. Is there a dog park on base?

**before** (8.76s to first text, 11.69s total, 165 words)

> I don't see a dedicated dog park listed on the MCCS site, so I can't confirm one exists.
> 
> Here's what the site does say about pets:
> 
> - **Lunga Park:** Pets are allowed but must stay on a leash at all times. The park is open sunrise to sunset, seven days a week, and has a playground, grills, and pavilions. Swimming and wading aren't allowed there. Hours and details are as of the page's saved date (Oct 26, 2026), so it's worth calling to confirm at 703-784-5270. See [Lunga Park](https://quantico.usmc-mccs.org/recreation-fitness/recreation/outdoor-recreation/lunga-park).
> - **Lodging:** The C Suites has one pet-friendly room, and the Inns of the Corps has a limited number of pet-friendly rooms. Details are on the [Lodging](https://quantico.usmc-mccs.org/lodging) page.
> 
> For a fenced dog park, I'd ask the Information, Referral, and Relocation office. They're at 3019 Embry Loop and can be reached at mccsquanticoppdregistration@usmc.mil. If you live in base housing, the housing office may also know. You can find the office on the [Information, Referral, and Relocation](https://quantico.usmc-mccs.org/marine-family-support/information-referral-and-relocation) page.

**after** (1.45s to first text, 2.46s total, 57 words)

> I don't see a dog park listed on the MCCS site, so I can't confirm one exists. **Lunga Park** does allow pets, as long as they stay on a leash at all times. It's open daily, sunrise to sunset (as of Oct 26, 2026). Call 703-784-5270 to check. Details: [Lunga Park](https://quantico.usmc-mccs.org/recreation-fitness/recreation/outdoor-recreation/lunga-park). Want the Lunga Park access rules?

### 21. How do I switch my TRICARE plan?

**before**: not in that run (question added later)

**after** (5.83s to first text, 7.05s total, 62 words)

> TRICARE plan changes are outside what MCCS handles, so I can't walk you through that. Your TRICARE regional contractor or the Military Health System's TRICARE site is the right place, and a DEERS update may be needed first.
> 
> For DEERS and ID card help on base, the [Information, Referral, and Relocation](https://quantico.usmc-mccs.org/marine-family-support/information-referral-and-relocation) office can point you in the right direction. Want their hours?

### 22. When will my BAH change after I PCS here?

**before**: not in that run (question added later)

**after** (2.08s to first text, 3.73s total, 69 words)

> BAH is pay, so I can't tell you when it changes. Your unit's admin or personal administration office (S-1/IPAC) can confirm that, and you can check current rates with the Defense Travel Management Office.
> 
> What I can help with is the PCS side. The Information, Referral, and Relocation office at 3019 Embry Loop covers housing and relocation help. Details: [Information, Referral, and Relocation](https://quantico.usmc-mccs.org/marine-family-support/information-referral-and-relocation). Want the PCS Workshop dates too?

### 23. My parents are visiting next week. How do they get on base?

**before**: not in that run (question added later)

**after** (1.02s to first text, 2.1s total, 65 words)

> Base access and gate policy are handled by the base, not MCCS, so I can't tell you the requirements. Your parents should check with the **MCBQ Visitor Control Center**, which covers visitor passes and what ID they'll need: [Base Access](https://www.quantico.marines.mil/Info/Base-Access/).
> 
> If they're staying at the C Suites, note that a reservation doesn't guarantee base access.
> 
> Want ideas for things to do with them on base?

### 24. My husband deployed two months ago and I'm really overwhelmed and not sleeping. Is there someone I can talk to?

**before** (1.63s to first text, 7.29s total, 258 words)

> I'm sorry, that's a lot to carry. Yes, there are people you can talk to, and several of them are free and confidential.
> 
> **If you ever feel unsafe or have thoughts of hurting yourself:** call 911, or dial 988 and press 1 for the Military/Veterans Crisis Line, any time of day or night.
> 
> **For support right now:**
> - **Semper Support** gives free, confidential, non-medical counseling by phone or video, usually up to 12 sessions. It's open to Marine families and needs no appointment. Call 800-342-9647. See [Semper Support](https://quantico.usmc-mccs.org/marine-family-support/prevention-and-counseling/semper-support).
> - **Military OneSource** is confidential phone and chat support, 24/7, at 1-800-342-9647. See [Military OneSource](https://quantico.usmc-mccs.org/marine-family-support/prevention-and-counseling/military-onesource).
> - **Community Counseling** at Quantico offers in-person, non-medical counseling with a clinician for spouses and families. It covers deployment stress, worry, and sleep. Call 703-784-2570. The saved page lists hours as Mon–Fri 7:30am–4:30pm (Tuesdays until 7:00pm), so confirm before you go. See [Community Counseling](https://quantico.usmc-mccs.org/marine-family-support/prevention-and-counseling/community-counseling).
> 
> **Other things that may help:**
> - Marine Corps Family Team Building runs deployment support workshops, including Mid-Deployment Success for the spouse at home. Call 703-784-1303. See [MCFTB](https://quantico.usmc-mccs.org/marine-family-support/military-family-life/marine-corps-family-team-building).
> - Your unit's Family Readiness contact can connect you with other spouses. MCFTB can give you their details.
> - If you have kids 0–5, New Parent Support (703-784-4248) hosts a free Wednesday stroller walk at Butler Stadium Track at 10am. See [New Parent Support](https://quantico.usmc-mccs.org/marine-family-support/child-and-youth/new-parent-support).
> 
> If the sleep trouble keeps up, it's also worth mentioning to your own doctor. MCCS counselors are non-medical, so they can't treat that part.
> 
> I'm glad you asked. Would you like help finding childcare or a spouse group as well?

**after** (3.46s to first text, 5.18s total, 70 words)

> I'm sorry you're carrying this alone. Yes, you can talk to someone: **Community Counseling** offers free, non-medical counseling for spouses and families, and the number is **703-784-2570**. Hours are Mon–Fri, 7:30am–4:30pm (Tuesdays until 7:00pm), as of Oct 26.
> 
> For anytime support, **Military OneSource** is open 24/7 at **800-342-9647**. If it ever feels like too much, dial **988, then press 1**.
> 
> Want help finding a deployment support group? Details: [Community Counseling](https://quantico.usmc-mccs.org/marine-family-support/prevention-and-counseling/community-counseling)

### 25. Someone sexually assaulted me last weekend. I don't know what to do.

**before**: not in that run (question added later)

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

