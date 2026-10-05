/**
 * Industry solution pages (English). Same rules as pages.tr.ts.
 */

export default {
  solutions: {
    eyebrow: 'Solutions',
    painsTitle: 'Sound familiar?',
    usesTitle: 'How Support.io works here',
    winsTitle: 'What changes',
    othersTitle: 'Other industries',
    featureLink: 'See the feature',
    items: {
      ecommerce: {
        name: 'E-commerce',
        tag: 'Shipping, returns, sizes and payment questions',
        photoAlt: 'Shop owner checking orders on a phone among parcels',
        headline: 'Let the shopper with a full cart ask — and keep the order',
        desc: '“Do you have this in M?”, “Where is my parcel?”, “How do returns work?” A shopper who asks on a product page will not wait. The chat opens right there, and questions with a known answer end in your help content.',
        pains: [
          { title: 'The same question thirty times a day', body: 'Shipping times, return policy, size charts — the team spends the day copy-pasting.' },
          { title: 'Silent loss at checkout', body: 'A stuck visitor does not ask, just closes the tab. You never learn why.' },
          { title: 'The “where is my order?” flood', body: 'During a campaign the inbox fills with order lookups and real problems get lost.' }
        ],
        uses: [
          { title: 'Sales conversations arrive instantly', body: 'You see which product the visitor is looking at while you reply; nobody waits.' },
          { title: 'You write first to those stuck at checkout', body: 'A visitor who stays on checkout for more than 30 seconds gets an offer of help automatically.' },
          { title: 'Shipping and returns answer themselves', body: 'Write the answer once in your help content; customers search and find it inside the bubble.' },
          { title: 'Returns go to the right team', body: 'Returns to operations, product questions to sales. Even in campaign week it is clear who handles what.' }
        ],
        wins: [
          { label: 'The team focuses on selling', body: 'Repeated questions stay in the help content.' },
          { label: 'Fewer abandoned carts', body: 'Stuck visitors get help before they leave.' },
          { label: 'Calm campaign weeks', body: 'Conversations spread across departments instead of piling up on one person.' }
        ]
      },
      saas: {
        name: 'Software / SaaS',
        tag: 'Trials, onboarding and bug reports',
        photoAlt: 'Software team working together at their screens',
        headline: 'Catch trial users before they get stuck and leave',
        desc: 'Someone new to your product rarely asks when they get stuck; they just leave. See who is stuck where, and send every question to the right team.',
        pains: [
          { title: 'Silent churn', body: 'The user stalled at setup does not ask for help and does not come back after the trial.' },
          { title: 'Everything lands on support', body: 'Billing questions and bug reports go to the same person and take hours to pass on.' },
          { title: 'No context', body: 'The agent starts by asking which screen and which plan the user is on.' }
        ],
        uses: [
          { title: 'Each topic goes to the right team', body: 'Billing to accounts, bugs to engineering, sales to sales. Departments are defined once.' },
          { title: 'See who is where, live', body: 'Which user has spent how long on which page streams into the dashboard. You write to the stuck one.' },
          { title: 'Repeated work becomes a rule', body: 'Pick rules like “if the message mentions an error, raise priority and send it to engineering”.' },
          { title: 'See the support load in numbers', body: 'How many questions per topic, how long the first reply took, which team carries what.' }
        ],
        wins: [
          { label: 'Stuck users are not lost', body: 'You write to whoever lingers on one screen.' },
          { label: 'No passing around', body: 'Questions reach the right team the first time.' },
          { label: 'Context ready', body: 'Who, where and what they asked before — beside you.' }
        ]
      },
      agency: {
        name: 'Agency / Many sites',
        tag: 'Client sites, separate teams, separate reports',
        photoAlt: 'Agency team gathered around a laptop, smiling',
        headline: 'Run dozens of sites from one dashboard without mixing data',
        desc: 'Every site you manage gets its own install line, its own look and its own reports. You choose which team member sees which site.',
        pains: [
          { title: 'One dashboard per site', body: 'A separate tool, password and invoice for every client.' },
          { title: 'Mixed-up data', body: 'One client’s conversations must never appear in another’s report.' },
          { title: 'Client reporting', body: 'Collecting numbers per client at month end takes hours.' }
        ],
        uses: [
          { title: 'A separate bubble per site', body: 'Colour, greeting and position are set per site; the same one line works on every platform.' },
          { title: 'You choose who sees what', body: 'Invite team members and set their roles. Nobody opens a screen they are not allowed to.' },
          { title: 'Reports per site', body: 'Filter reports to one site; the numbers for your client are ready.' },
          { title: 'A team per client', body: 'Each client’s conversations go to the department that looks after them.' }
        ],
        wins: [
          { label: 'One login', body: 'No more a dashboard per site.' },
          { label: 'Separation per site', body: 'Conversations and reports stay with their site.' },
          { label: 'Reports ready', body: 'Walk into the month-end meeting with numbers.' }
        ]
      },
      health: {
        name: 'Clinics / Health',
        tag: 'Appointments, prices and directions',
        photoAlt: 'Smiling doctor talking to a patient in a clinic',
        headline: 'Take phone questions in writing, even after hours',
        desc: 'Appointment, price and address questions keep the phone busy. When they come through chat, your team can help several people at once.',
        pains: [
          { title: 'The line is always busy', body: 'Reception juggles a patient at the desk and a ringing phone.' },
          { title: 'Silence after hours', body: 'An evening question goes unanswered and the patient writes elsewhere.' },
          { title: 'The same information', body: 'Opening hours, parking, prices — the same answer dozens of times a day.' }
        ],
        uses: [
          { title: 'Several people at once', body: 'While one person is on the phone, four can be answered in chat.' },
          { title: 'Common questions answer themselves', body: 'Hours, address and preparation notes live in the help content; patients find them in the bubble.' },
          { title: 'The right message after hours', body: 'Anyone writing outside business hours is told when you will reply; the message waits in the morning inbox.' },
          { title: 'The team sees who asked what', body: 'Reception, billing and the doctor’s assistant can pass a conversation to one another.' }
        ],
        wins: [
          { label: 'The phone frees up', body: 'Routine questions move to writing and help content.' },
          { label: 'Night messages are kept', body: 'They wait first thing in the inbox.' },
          { label: 'Patients do not wait', body: 'Simple answers in seconds.' }
        ]
      },
      hospitality: {
        name: 'Hotels / Restaurants',
        tag: 'Bookings, rooms and menu questions',
        photoAlt: 'Modern hotel reception with wooden details',
        headline: 'Answer the guest on your booking page, right away',
        desc: 'Room types, early check-in, parking, allergens… A guest about to book who cannot find the answer moves on to another tab.',
        pains: [
          { title: 'Bookings left half-done', body: 'The guest who asked looks at another hotel while waiting.' },
          { title: 'Guests in many languages', body: 'Answering English, German and Russian questions at the same speed is hard.' },
          { title: 'Repeated requests', body: 'Airport transfers and early check-in are typed out again every day.' }
        ],
        uses: [
          { title: 'You write first on the booking page', body: 'A guest lingering over room choice gets an offer of help automatically.' },
          { title: 'Straight to reception', body: 'The message is on the team’s screen the moment it is written; files and photos can be shared.' },
          { title: 'Common questions inside the bubble', body: 'Guests search and find check-in times, parking and breakfast answers themselves.' },
          { title: 'Group and event requests tracked', body: 'A conversation that turns into a big booking becomes a deal, tracked by stage.' }
        ],
        wins: [
          { label: 'No half-done bookings', body: 'Questions are answered before the guest leaves.' },
          { label: 'No retyping', body: 'Transfer and early check-in answers go out as a saved message from a rule.' },
          { label: 'Group sales kept', body: 'Large requests are tracked in their own pipeline.' }
        ]
      },
      education: {
        name: 'Education',
        tag: 'Enrolment, courses and payments',
        photoAlt: 'Student with headphones attending an online class on a laptop',
        headline: 'Do not drown in questions during enrolment',
        desc: 'Enrolment dates, schedules, payment options… Hundreds of questions at the start of term swamp the team. Let help content handle the ones with a known answer and send the rest to the right office.',
        pains: [
          { title: 'Start-of-term pile-up', body: 'For two weeks the inbox is full of enrolment questions.' },
          { title: 'Questions to the wrong office', body: 'Payment questions go to academics, course questions to accounts.' },
          { title: 'Invisible load', body: 'You do not know which topic peaks in which week.' }
        ],
        uses: [
          { title: 'Known answers end on their own', body: 'Dates and documents are in the help content; students search and find them.' },
          { title: 'On the team’s screen at once', body: 'You reply knowing which page the student wrote from; nobody waits on the phone line.' },
          { title: 'Each question to the right office', body: 'Enrolment, payments and academic questions go to separate departments.' },
          { title: 'See the peaks in advance', body: 'Reports show how many questions came in each week, by topic.' }
        ],
        wins: [
          { label: 'The team breathes', body: 'Routine questions stay in the help content.' },
          { label: 'Students do not wait', body: 'Known answers in seconds.' },
          { label: 'Ready for next term', body: 'You know where the load will be.' }
        ]
      }
    }
  }
};
