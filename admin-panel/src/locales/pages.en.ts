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
        desc: '“Do you have this in M?”, “How long is delivery?”, “How do returns work?” A shopper who asks on a product page will not wait. The AI assistant answers common questions day and night; conversations that turn into sales stay with your team.',
        pains: [
          {
            title: 'The same question thirty times a day',
            body: 'Shipping times, return policy, size charts — the team spends the day copy-pasting.'
          },
          {
            title: 'Silent loss at checkout',
            body: 'A stuck visitor does not ask, just closes the tab. You never learn why.'
          },
          {
            title: 'The “where is my order?” flood',
            body: 'During a campaign the inbox fills with order lookups and real problems get lost.'
          }
        ],
        uses: [
          {
            title: 'Sales conversations arrive instantly',
            body: 'You see which product the visitor is looking at while you reply; nobody waits.'
          },
          {
            title: 'You write first to those stuck at checkout',
            body: 'A visitor who stays on checkout for more than 30 seconds gets an offer of help automatically.'
          },
          {
            title: 'AI answers shipping and returns questions',
            body: 'Return window, shipping cost, size chart… the assistant gives the answer you wrote once in your FAQ, in seconds, and leaves the rest to your team.'
          },
          {
            title: 'Returns go to the right team',
            body: 'Returns to operations, product questions to sales. Even in campaign week it is clear who handles what.'
          }
        ],
        wins: [
          { label: 'The team focuses on selling', body: 'The AI handles repeated questions.' },
          { label: 'Fewer abandoned carts', body: 'Stuck visitors get help before they leave.' },
          {
            label: 'Calm campaign weeks',
            body: 'Conversations spread across departments instead of piling up on one person.'
          }
        ]
      },
      saas: {
        name: 'Software / SaaS',
        tag: 'Trials, onboarding and bug reports',
        photoAlt: 'Software team working together at their screens',
        headline: 'Catch trial users before they get stuck and leave',
        desc: 'Someone new to your product rarely asks when they get stuck; they just leave. See who is stuck where, and send every question to the right team.',
        pains: [
          {
            title: 'Silent churn',
            body: 'The user stalled at setup does not ask for help and does not come back after the trial.'
          },
          {
            title: 'Everything lands on support',
            body: 'Billing questions and bug reports go to the same person and take hours to pass on.'
          },
          {
            title: 'No context',
            body: 'The agent starts by asking which screen and which plan the user is on.'
          }
        ],
        uses: [
          {
            title: 'Each topic goes to the right team',
            body: 'Billing to accounts, bugs to engineering, sales to sales. Departments are defined once.'
          },
          {
            title: 'See who is where, live',
            body: 'Which user has spent how long on which page streams into the dashboard. You write to the stuck one.'
          },
          {
            title: 'Repeated work becomes a rule',
            body: 'Pick rules like “if the message mentions an error, raise priority and send it to engineering”.'
          },
          {
            title: 'See the support load in numbers',
            body: 'How many questions per topic, how long the first reply took, which team carries what.'
          }
        ],
        wins: [
          {
            label: 'Stuck users are not lost',
            body: 'You write to whoever lingers on one screen.'
          },
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
          {
            title: 'One dashboard per site',
            body: 'A separate tool, password and invoice for every client.'
          },
          {
            title: 'Mixed-up data',
            body: 'One client’s conversations must never appear in another’s report.'
          },
          {
            title: 'Client reporting',
            body: 'Collecting numbers per client at month end takes hours.'
          }
        ],
        uses: [
          {
            title: 'A separate bubble per site',
            body: 'Colour, greeting and position are set per site; the same one line works on every platform.'
          },
          {
            title: 'You choose who sees what',
            body: 'Invite team members and set their roles. Nobody opens a screen they are not allowed to.'
          },
          {
            title: 'Reports per site',
            body: 'Filter reports to one site; the numbers for your client are ready.'
          },
          {
            title: 'A team per client',
            body: 'Each client’s conversations go to the department that looks after them.'
          }
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
          {
            title: 'The line is always busy',
            body: 'Reception juggles a patient at the desk and a ringing phone.'
          },
          {
            title: 'Silence after hours',
            body: 'An evening question goes unanswered and the patient writes elsewhere.'
          },
          {
            title: 'The same information',
            body: 'Opening hours, parking, prices — the same answer dozens of times a day.'
          }
        ],
        uses: [
          {
            title: 'Several people at once',
            body: 'While one person is on the phone, four can be answered in chat.'
          },
          {
            title: 'AI answers common questions',
            body: 'Opening hours, address, parking and preparation notes — the assistant answers from your FAQ, after hours too.'
          },
          {
            title: 'The right message after hours',
            body: 'Anyone writing outside business hours is told when you will reply; the message waits in the morning inbox.'
          },
          {
            title: 'The team sees who asked what',
            body: 'Reception, billing and the doctor’s assistant can pass a conversation to one another.'
          }
        ],
        wins: [
          { label: 'The phone frees up', body: 'The AI assistant handles routine questions.' },
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
          {
            title: 'Bookings left half-done',
            body: 'The guest who asked looks at another hotel while waiting.'
          },
          {
            title: 'Guests in many languages',
            body: 'Answering English, German and Russian questions at the same speed is hard.'
          },
          {
            title: 'Repeated requests',
            body: 'Airport transfers and early check-in are typed out again every day.'
          }
        ],
        uses: [
          {
            title: 'You write first on the booking page',
            body: 'A guest lingering over room choice gets an offer of help automatically.'
          },
          {
            title: 'Straight to reception',
            body: 'The message is on the team’s screen the moment it is written; files and photos can be shared.'
          },
          {
            title: 'AI answers common questions',
            body: 'Check-in time, parking, breakfast, pets — the assistant answers in seconds, even at midnight.'
          },
          {
            title: 'Group and event requests tracked',
            body: 'A conversation that turns into a big booking becomes a deal, tracked by stage.'
          }
        ],
        wins: [
          {
            label: 'No half-done bookings',
            body: 'Questions are answered before the guest leaves.'
          },
          {
            label: 'No retyping',
            body: 'Transfer and early check-in answers go out as a saved message from a rule.'
          },
          { label: 'Group sales kept', body: 'Large requests are tracked in their own pipeline.' }
        ]
      },
      education: {
        name: 'Education',
        tag: 'Enrolment, courses and payments',
        photoAlt: 'Student with headphones attending an online class on a laptop',
        headline: 'Do not drown in questions during enrolment',
        desc: 'Enrolment dates, schedules, payment options… Hundreds of questions at the start of term swamp the team. Let the AI assistant handle the ones with a known answer and send the rest to the right office.',
        pains: [
          {
            title: 'Start-of-term pile-up',
            body: 'For two weeks the inbox is full of enrolment questions.'
          },
          {
            title: 'Questions to the wrong office',
            body: 'Payment questions go to academics, course questions to accounts.'
          },
          { title: 'Invisible load', body: 'You do not know which topic peaks in which week.' }
        ],
        uses: [
          {
            title: 'AI answers the known questions',
            body: 'Enrolment dates, required documents, payment options — the assistant answers from your FAQ in seconds.'
          },
          {
            title: 'On the team’s screen at once',
            body: 'You reply knowing which page the student wrote from; nobody waits on the phone line.'
          },
          {
            title: 'Each question to the right office',
            body: 'Enrolment, payments and academic questions go to separate departments.'
          },
          {
            title: 'See the peaks in advance',
            body: 'Reports show how many questions came in each week, by topic.'
          }
        ],
        wins: [
          { label: 'The team breathes', body: 'The AI handles routine questions.' },
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
        'An AI assistant that answers common questions in your chat bubble 24/7, in seconds. It speaks from your own FAQ and hands what it does not know to your team.'
    },
    eyebrow: 'AI assistant',
    title: 'An assistant that answers your customers day and night',
    desc: 'The Support.io AI assistant answers common questions in your chat bubble within seconds. It speaks from your own FAQ, never makes things up, and hands the conversation to your team when needed.',
    ctaPrimary: 'Start free',
    ctaSecondary: 'See plans',
    heroPoints: ['No setup', 'Included in every plan', 'Switch it off any time'],

    howEyebrow: 'How it works',
    howTitle: 'Live in three steps',
    how: [
      {
        title: 'Write your FAQ',
        body: 'Add your most common questions and answers in the dashboard. The assistant answers only from them.'
      },
      {
        title: 'Switch it on',
        body: 'Turn it on for your site on the AI Assistant screen. No code, integration or training needed.'
      },
      {
        title: 'Give your team a break',
        body: 'Common questions end with the assistant; conversations that turn into sales or real problems reach your team.'
      }
    ],

    benefitsEyebrow: 'What you get',
    benefitsTitle: 'Your team never types the same answer twice',
    benefits: [
      { title: 'Instant answers', body: 'Visitors do not wait; their answer arrives in seconds.' },
      {
        title: 'Open after hours',
        body: 'Common questions at night or at the weekend do not wait for the morning.'
      },
      {
        title: 'Speaks from your content',
        body: 'It says only what your FAQ says; no invented prices, dates or promises.'
      },
      {
        title: 'Smart handoff',
        body: 'No answer, a visitor asking for a person, or a hiccup — the conversation goes to your team.'
      },
      {
        title: 'Your team comes first',
        body: 'The moment an agent writes or presses “Take over”, the assistant goes quiet in that conversation.'
      },
      {
        title: 'See what it does',
        body: 'Track how many questions it answered and why it handed others over.'
      }
    ],

    controlEyebrow: 'You are in control',
    controlTitle: 'Answers always rest on your own knowledge',
    controlDesc:
      'Under every answer the assistant notes which FAQ entry it relied on. Your team sees this in the inbox; fixing a missing or outdated entry takes a minute.',
    controlPoints: [
      'An answer it cannot back up is never sent',
      'Visitors can press “Talk to a person” at any moment',
      'Switch it on per site, and off whenever you like'
    ],

    trustEyebrow: 'Trust',
    trustTitle: 'Customer data comes first',
    trust: [
      'The visitor’s name, e-mail and earlier messages are never sent to the AI.',
      'E-mails and phone numbers in a question are masked before it is sent.',
      'If a card number, IBAN or ID number is shared, the question is not sent and the conversation goes to your team.',
      'The assistant never asks visitors for personal details.'
    ],

    plansEyebrow: 'Plans',
    plansTitle: 'Included in every plan, growing as you grow',
    plansDesc:
      'The plans differ in the number and depth of answers. When the allowance runs out the chat does not stop; new questions go straight to your team.',
    perMonth: '{{n}} answers a month',
    perConversation: 'Up to {{count}} answers per conversation',
    depth: {
      FREE: 'Short, to-the-point answers',
      PRO: 'More detailed answers',
      ENTERPRISE: 'The most detailed answers and the widest FAQ coverage'
    },
    seePricing: 'All plan details',

    faqTitle: 'Questions about the assistant',
    faq: [
      {
        q: 'What if the assistant says something wrong?',
        a: 'It answers only from your FAQ entries and notes which entry each answer relies on. An answer it cannot back up is never sent; the conversation goes to your team.'
      },
      {
        q: 'What does it take to set up?',
        a: 'Nothing technical. Add your FAQ in the dashboard and switch the assistant on for your site.'
      },
      {
        q: 'What if a visitor wants a person?',
        a: 'They press “Talk to a person” in the bubble or simply say so; the conversation goes to your team at once.'
      },
      {
        q: 'What if we use up the monthly answers?',
        a: 'The chat does not stop; new questions go straight to your team. The allowance resets each month, and you can upgrade for more.'
      },
      { q: 'Which language does it answer in?', a: 'Turkish, in short and clear answers.' }
    ],

    ctaTitle: 'Put your assistant to work today',
    ctaDesc: 'Open a free account, add your FAQ, switch the assistant on. No credit card required.',
    ctaBtn: 'Start free'
  },

  legal: {
    updated: 'Last updated: 7 October 2026',
    contact: 'Questions: {{supportEmail}}',
    privacy: {
      meta: 'What data Support.io processes and why, how long it keeps it, and your rights.',
      title: 'Privacy Policy',
      intro:
        'Support.io lets businesses add live chat and an AI assistant to their websites. This policy covers both the businesses that open a Support.io account and the visitors who use the chat bubble on their sites.',
      sections: [
        {
          h: 'Roles',
          p: [
            'Support.io is the controller of your account data.',
            'For the chat data of a site’s visitors, the business that added the bubble is the controller; Support.io processes that data on its behalf and instructions.'
          ]
        },
        {
          h: 'What we process',
          p: [
            'Account: name, e-mail, role, a one-way hash of the password, session and activity records.',
            'Visitor: chat messages and files; their name and e-mail if they type them; the page they are on, browser and operating system, IP address and country.',
            'Payment: card details never reach us. Paddle takes payments and invoices as the seller.'
          ]
        },
        {
          h: 'Why',
          p: [
            'To run the service: deliver, store and show messages to your team.',
            'Security: preventing abuse and unauthorised access, rate limiting.',
            'Account e-mails: verification, password reset, team invitations and usage warnings. We send no marketing e-mail.',
            'Billing and legal obligations.'
          ]
        },
        {
          h: 'The AI assistant',
          p: [
            'If a business switches the assistant on, the visitor’s question and the site’s public FAQ entries are sent to our AI service provider to produce an answer. E-mail addresses and phone numbers in the question are masked first.',
            'The visitor’s name, e-mail and earlier messages are never sent. A question containing a card number, IBAN or ID number is not sent at all; the conversation goes to the team.'
          ]
        },
        {
          h: 'How long we keep it',
          p: [
            'Conversations are kept for the period the business chooses after their last message: 90 days on the Free plan, from 30 days to 5 years on paid plans. Conversations past that period are deleted every night with their attachments; the business can delete one earlier.',
            'Visitors’ IP addresses and device details are deleted 90 days after their last visit; IP addresses in activity records after 90 days.',
            'Deleting an account deletes its data; it leaves the encrypted backups within three months.'
          ]
        },
        {
          h: 'Who we share it with',
          p: [
            'We do not sell data. We share it only as far as needed with the providers that run the service: hosting, file storage, e-mail delivery, payments and the AI service.'
          ]
        },
        {
          h: 'Cookies and browser storage',
          p: [
            'The dashboard uses a required session cookie (sc_session) and a security cookie (sc_csrf).',
            'So that a conversation survives page changes, the chat bubble keeps a signed visitor session (sc_widget_session) in the browser’s local storage, and the visitor’s name and e-mail (sc_visitor_name, sc_visitor_email) if they typed them. No advertising or tracking cookies.'
          ]
        },
        {
          h: 'Your rights',
          p: [
            'Under KVKK and GDPR you may access, correct, delete and port your data and object to its processing.',
            'Account owners can download all data under Settings → Data and privacy and delete the account. Visitors can send requests to the business concerned or to us; the business can delete all of a visitor’s data on its site from the panel in one step.'
          ]
        }
      ]
    },
    terms: {
      meta: 'The terms of use of the Support.io service.',
      title: 'Terms of Use',
      intro: 'By using Support.io you accept these terms. We have tried to keep them short.',
      sections: [
        {
          h: 'The service',
          p: [
            'Support.io gives your site a chat bubble, an AI assistant and a dashboard for your team. Features depend on your plan.'
          ]
        },
        {
          h: 'Your account',
          p: [
            'You give accurate details and keep your password safe.',
            'You are responsible for what the people you invite do in your account.'
          ]
        },
        {
          h: 'Plans and payment',
          p: [
            'The free plan has no time limit. Paid plans are billed in advance, monthly or yearly; Paddle takes the payment as the seller.',
            'Cancel any time; your plan runs until the paid period ends. If a payment fails, the plan returns to Free after 7 days.',
            'The site, user, conversation and AI answer limits of each plan are enforced on the server.'
          ]
        },
        {
          h: 'Acceptable use',
          p: [
            'You may not use the service for illegal content, spam, malware or collecting other people’s data without permission.',
            'We may suspend an account that breaks these rules.'
          ]
        },
        {
          h: 'Visitor data',
          p: [
            'You are the controller of your visitors’ data. State in your site’s privacy notice that you use Support.io for live chat.'
          ]
        },
        {
          h: 'The AI assistant',
          p: [
            'The assistant bases its answers on your FAQ content; you are responsible for that content being correct.',
            'AI can make mistakes. When unsure, the assistant hands the conversation to your team, and your team can take over at any time.'
          ]
        },
        {
          h: 'Availability',
          p: [
            'We take reasonable care to keep the service running and back up data regularly, but we do not guarantee it will never be interrupted.'
          ]
        },
        {
          h: 'Limitation of liability',
          p: [
            'To the extent the law allows, we are not liable for indirect losses; our liability for direct losses is limited to what you paid us in the last 12 months.'
          ]
        },
        {
          id: 'guvenlik',
          h: 'Reporting a vulnerability',
          p: [
            'If you believe you have found a security vulnerability in our service, write to {{securityEmail}}. Tell us how to reproduce it and which address it affects. The same details are in /.well-known/security.txt.',
            'We confirm that we received your report within 3 working days and aim to fix the issue within 90 days at the latest. Please do not share the details publicly until the fix is live.',
            'Please test only against your own account; do not access other people’s data, and do not run load tests that slow the service down or attempt social engineering. We do not run a bug bounty at the moment.'
          ]
        },
        {
          h: 'Changes and law',
          p: [
            'We will tell you by e-mail about significant changes to these terms.',
            'These terms are governed by the laws of the Republic of Türkiye.'
          ]
        }
      ]
    }
  }
};
