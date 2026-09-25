/**
 * Industry solutions and the AI page (English). Same rules as pages.tr.ts.
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
        desc: '“Do you have this in M?”, “Where is my parcel?”, “How do returns work?” The assistant answers the questions you get hundreds of times a day; the conversations that turn into sales stay with your team.',
        pains: [
          { title: 'The same question thirty times a day', body: 'Shipping times, return policy, size charts — the team spends the day copy-pasting.' },
          { title: 'Silent loss at checkout', body: 'A stuck visitor does not ask, just closes the tab. You never learn why.' },
          { title: 'The “where is my order?” flood', body: 'During a campaign the inbox fills with order lookups and real problems get lost.' }
        ],
        uses: [
          { title: 'The assistant tells them where the order is', body: 'When a signed-in customer asks, the assistant looks the order up in your shop’s system and writes the status. Anything that needs an action, like an address change, goes to your team.' },
          { title: 'Sales conversations arrive instantly', body: 'You see which product the visitor is looking at while you reply; nobody waits.' },
          { title: 'You write first to those stuck at checkout', body: 'A visitor who stays on checkout for more than 30 seconds gets an offer of help automatically.' },
          { title: 'Shipping and returns answer themselves', body: 'Write the answer once in your help content; customers search and find it inside the bubble.' }
        ],
        wins: [
          { label: 'The team focuses on selling', body: 'Repeated questions stay with the assistant and help content.' },
          { label: 'Fewer abandoned carts', body: 'Stuck visitors get help before they leave.' },
          { label: 'Calm campaign weeks', body: 'Order lookups do not clog the queue.' }
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
          { title: 'The assistant answers common questions', body: 'Check-in times, parking and breakfast from your help content; drafts and translations for your staff.' },
          { title: 'Straight to reception', body: 'The message is on the team’s screen the moment it is written; files and photos can be shared.' },
          { title: 'Group and event requests tracked', body: 'A conversation that turns into a big booking becomes a deal, tracked by stage.' }
        ],
        wins: [
          { label: 'No half-done bookings', body: 'Questions are answered before the guest leaves.' },
          { label: 'Every language', body: 'Agents translate their reply into the guest’s language.' },
          { label: 'Group sales kept', body: 'Large requests are tracked in their own pipeline.' }
        ]
      },
      education: {
        name: 'Education',
        tag: 'Enrolment, courses and payments',
        photoAlt: 'Student with headphones attending an online class on a laptop',
        headline: 'Do not drown in questions during enrolment',
        desc: 'Enrolment dates, schedules, payment options… Hundreds of questions at the start of term swamp the team. Let the assistant and help content handle the ones with a known answer.',
        pains: [
          { title: 'Start-of-term pile-up', body: 'For two weeks the inbox is full of enrolment questions.' },
          { title: 'Questions to the wrong office', body: 'Payment questions go to academics, course questions to accounts.' },
          { title: 'Invisible load', body: 'You do not know which topic peaks in which week.' }
        ],
        uses: [
          { title: 'Known answers end on their own', body: 'Dates and documents are in the help content; students search and find them.' },
          { title: 'The assistant replies first', body: 'It answers what the help content covers and hands the rest to a person the moment it is unsure.' },
          { title: 'Each question to the right office', body: 'Enrolment, payments and academic questions go to separate departments.' },
          { title: 'See the peaks in advance', body: 'Reports show how many questions came in each week, by topic.' }
        ],
        wins: [
          { label: 'The team breathes', body: 'Routine questions stay with help content and the assistant.' },
          { label: 'Students do not wait', body: 'Known answers in seconds.' },
          { label: 'Ready for next term', body: 'You know where the load will be.' }
        ]
      }
    }
  },

  aiPage: {
    meta: {
      title: 'AI assistant',
      description:
        'An AI assistant that runs on your own server, answers customers from your help content and hands over to your team when it is unsure.'
    },
    eyebrow: 'AI assistant',
    title: 'Let the assistant answer the simple questions, your team the rest',
    desc: 'The assistant only says what is in your help content, checks a signed-in customer’s order, and hands over to a person the moment it is unsure. The model runs on your server; conversations go nowhere.',
    ctaPrimary: 'Start free',
    ctaSecondary: 'Setup guide',
    heroPoints: ['No per-question fee', 'Data never leaves your server', 'Hand over to a person any time'],

    modesEyebrow: 'Three modes',
    modesTitle: 'You decide how much the assistant gets to say',
    modesDesc: 'The mode is chosen per site. A new site always starts off.',
    modes: [
      { name: 'Off', tag: 'Default', body: 'No assistant. Conversations go straight to your team, as before.', points: ['No message is sent to the model', 'Keyword FAQ answers keep working'] },
      { name: 'Copilot', tag: 'For agents', body: 'The assistant never writes to visitors; it sits beside the agent and suggests.', points: ['Summary of a long thread', 'Draft reply and tone fixes', 'Translation and questions to your help content'] },
      { name: 'Auto reply', tag: 'For visitors', body: 'The assistant answers visitors itself and hands over when needed.', points: ['Greetings and FAQ answers', 'Order status lookup', 'Politely declines what is out of scope'] }
    ],

    doesEyebrow: 'In auto reply',
    doesTitle: 'What the assistant does, and what it never does',
    does: [
      { title: 'Greets and guides', body: 'Says what it can help with, so nobody is left in the dark.' },
      { title: 'Answers from your help content', body: 'Only from matching FAQ entries, short and plain.' },
      { title: 'Checks orders', body: 'Looks up a verified customer’s order in your shop’s own system.' },
      { title: 'Declines what is out of scope', body: 'Politely says no to questions unrelated to your business.' },
      { title: 'Knows your hours', body: 'When handing over after hours, tells the customer when you will reply.' },
      { title: 'Hands over', body: 'When a person is asked for, on a complaint, when an action is needed, or in doubt.' }
    ],
    neverTitle: 'Blocked in code',
    never: [
      'Card, IBAN or ID numbers are never sent to the model',
      'A reply with a number, date or link that is not in the sources never reaches the customer',
      'A reply claiming an action was done (“I have refunded you”) is never sent',
      'The assistant goes quiet the moment an agent takes over',
      'No more automatic replies than the limit you set',
      'If the model is down or busy, the conversation goes to a person without waiting'
    ],

    copilotEyebrow: 'Beside the agent',
    copilotTitle: 'Take over a long thread without reading it from the top',
    copilotDesc: 'Copilot mode opens a panel beside every conversation. Suggestions are always shown to the agent and never reach the customer until you approve them.',
    copilot: ['Conversation summary', 'Draft reply', 'Soften or formalise the tone', 'Translate to the customer’s language', 'Sentiment and priority analysis', 'Ask your help content'],

    orderEyebrow: 'Order lookup',
    orderTitle: 'Keep “where is my parcel?” from ever reaching your team',
    orderDesc: 'If the customer is signed in on your site, the assistant looks up their order in your shop’s own system. Your server confirms whose order is being checked with a signature; nobody else’s order is ever shown.',
    orderSteps: [
      { title: 'The customer is signed in', body: 'Your site tells the bubble who the customer is, signed.' },
      { title: 'The assistant asks', body: 'A signed request goes to your shop’s order service; only that customer’s orders come back.' },
      { title: 'The customer finds out', body: 'Status, carrier and expected delivery in one plain sentence.' }
    ],

    privacyEyebrow: 'Privacy',
    privacyTitle: 'The model is on your machine. Full stop.',
    privacyDesc: 'The assistant runs an open language model on your own graphics card. It never falls back to another company’s service: if the model is down, conversations go straight to your team.',
    requirements: [
      { label: 'Graphics card', value: 'NVIDIA with 12–16 GB' },
      { label: 'Memory', value: '16 GB (32 GB recommended)' },
      { label: 'Disk', value: 'About 40 GB' },
      { label: 'Per-question fee', value: 'None' }
    ],

    faqTitle: 'Questions about the assistant',
    faq: [
      { q: 'What if I have no graphics card?', a: 'The rest of the product works as it is; only the assistant shows as off. Live chat, the inbox and automatic rules do not need the model.' },
      { q: 'Does the assistant try to answer everything?', a: 'No. Anything your help content does not answer, anything that needs an action, and any conversation where the customer asks for a person goes to your team.' },
      { q: 'Does the customer know they are talking to an assistant?', a: 'Yes. Its messages carry an “Assistant” label in the bubble, and the customer can ask for an agent at any moment.' },
      { q: 'Does it answer in Turkish and English?', a: 'Yes; it replies in the language the customer writes in. Handover and warning texts exist in both languages.' }
    ]
  }
};
