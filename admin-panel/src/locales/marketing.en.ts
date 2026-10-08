/**
 * Marketing copy (English).
 *
 * Mirrors `marketing.tr.js` key for key. Same two rules apply:
 *
 *   1. The reader runs a support team, not a build pipeline. No "WebSocket",
 *      no "Shadow DOM", no "round-robin". Their plain equivalents instead.
 *      The technical wording still exists — in the collapsed "technical note"
 *      block on each feature page and in the docs.
 *   2. No invented numbers. No customer counts, no satisfaction scores, no
 *      uptime claims. Nothing here that cannot be checked.
 */

export default {
  common: {
    skipToContent: 'Skip to content'
  },

  nav: {
    allFeatures: 'See all features',
    product: 'Product',
    solutions: 'Solutions',
    ai: 'AI',
    new: 'New',
    resourcesLabel: 'Resources',
    resources: {
      docs: { title: 'Setup guide', body: 'Every step from one line to identity verification.' },
      about: { title: 'About us', body: 'Why we exist and how we make decisions.' },
      contact: { title: 'Write to us', body: 'The chat bubble on this site is the same product.' }
    },
    groups: {
      talk: 'Talk to customers',
      organize: 'Organise the work',
      grow: 'Measure and grow'
    }
  },

  homePage: {
    hero: {
      title: 'Every message answered,',
      accent: 'no customer left waiting.',
      desc: 'Add live chat to your site with one line. The AI assistant answers common questions in seconds; your team handles the rest from one inbox.',
      tour: 'Tour the product',
      photoAlt: 'Support agent with a headset answering a customer at a computer',
      notifTitle: 'New conversation · /pricing',
      notifBody: 'Visitor has been on the pricing page for 40 seconds',
      handoff: 'Selin is replying'
    },
    tour: {
      eyebrow: 'Product tour',
      title: 'The screens your team keeps open all day',
      desc: 'Click through. Each one is a real screen in the dashboard, there the day you open your account.'
    },
    industries: {
      eyebrow: 'Who it is for',
      title: 'For every business that talks to its customers',
      desc: 'A shop, a SaaS, a clinic, a hotel or a school — one product, in the language of your work.',
      explore: 'Explore',
      prev: 'Previous industry',
      next: 'Next industry'
    },
    story: {
      eyebrow: 'The life of a conversation',
      title: 'From the moment a message arrives to the moment it closes',
      desc: 'Scroll down and follow one sentence from a visitor as it moves through your team.',
      steps: [
        {
          title: 'Every message in one inbox',
          body: 'Questions from the chat bubble, a proactive message or the help content all land in one list — who asked, on which page, and what, right beside it.',
          chips: ['Chat', 'Files', 'Proactive', 'History']
        },
        {
          title: 'AI gives the first answer',
          body: 'The assistant finds the answer in your own FAQ and replies in seconds. If there is none, or the visitor asks for a person, the conversation goes to your team at once.',
          chips: ['AI', 'FAQ', 'Handoff']
        },
        {
          title: 'The rest goes to the right person',
          body: 'Billing to accounts, plan questions to sales. Define departments once; each conversation goes to whoever is available right now.',
          chips: ['Department', 'Queue', 'Hours']
        },
        {
          title: 'Repeated work becomes a rule',
          body: 'Pick rules like “if the message mentions an invoice, tag it and send it to accounts” from a list. No code, and every run is logged.',
          chips: ['Tags', 'Priority', 'Saved replies']
        },
        {
          title: 'At month end, you can see what happened',
          body: 'How many questions came in, how long the first reply took, which were solved and what each agent did. Numbers instead of guesses.',
          chips: ['First reply', 'Resolution', 'Agents']
        }
      ]
    },
    ai: {
      eyebrow: 'AI assistant',
      title: 'Let AI answer the common questions, so your team can do the real work',
      desc: 'The assistant gives the first answer in your chat bubble: pricing, setup, delivery, opening hours… It answers only from your own FAQ; it never makes things up and hands what it does not know to your team.',
      points: [
        {
          title: 'Answers 24/7',
          body: 'Questions at night or at the weekend do not wait for the morning; the assistant replies in seconds.'
        },
        {
          title: 'Speaks from your content',
          body: 'It relies only on your FAQ, and your team sees which entry each answer came from.'
        },
        {
          title: 'Hands over what it does not know',
          body: 'No answer, or the visitor asks for a person? The conversation goes to your team at once.'
        },
        {
          title: 'Customer data protected',
          body: 'If a card number, IBAN or ID number is shared, the question is never sent to the AI.'
        }
      ],
      plans: 'Included in every plan · from {{n}} answers a month',
      cta: 'Explore the assistant',
      cta2: 'Try it free'
    },
    setup: {
      eyebrow: 'Setup',
      title: 'One line. Live in minutes.',
      desc: 'The moment you paste it, the bubble is on your site. The rest happens in the dashboard: pick the colour, switch on the AI assistant, invite your team. No developer needed.',
      keyPlaceholder: 'YOUR_SITE_KEY',
      comment: 'Support.io chat bubble',
      noDevs: {
        eyebrow: 'No developers',
        title: 'Copy, paste, done.',
        body: 'WordPress, Shopify, Wix or a site you built yourself — the same line everywhere. On React, Vue or Angular, the guide has the code ready to copy.'
      },
      devices: {
        eyebrow: 'Anywhere',
        title: 'Reply from your phone too.',
        body: 'The dashboard runs in the browser — the same inbox at your desk or on the go. Nothing to install.',
        desktop: 'Desktop',
        tablet: 'Tablet',
        phone: 'Phone'
      },
      board: {
        title: 'Dashboard',
        sample: 'Sample',
        replies: 'Replies today',
        online: '3 agents online'
      },
      stats: [
        { label: 'Avg. first reply', value: '1m 40s' },
        { label: 'Resolved', value: '92%' },
        { label: 'Answered by AI', value: '41%' }
      ]
    },
    features: {
      eyebrow: 'All in one',
      title: 'Ready the day you open your account',
      desc: 'Not a roadmap — the screens that are switched on in the dashboard today.'
    },
    trustPhotoAlt: 'A small team meeting around a table',
    faq: {
      eyebrow: 'FAQ',
      title: 'Frequently asked questions',
      categories: 'Categories',
      still: 'Still have questions?',
      chat: 'Chat with our team',
      contact: 'Get in touch',
      cat: {
        all: 'All',
        pricing: 'Pricing',
        setup: 'Setup',
        ai: 'AI',
        usage: 'Day to day',
        security: 'Security'
      },
      items: [
        {
          cat: 'pricing',
          q: 'Is the free plan really free?',
          a: 'Yes — no time limit and no credit card. It includes one site, one user and 100 new conversations a month.'
        },
        {
          cat: 'pricing',
          q: 'What happens when my team grows?',
          a: 'Move to Pro: 3 sites, 5 users and 2,000 new conversations a month for one flat monthly price. There is no per-seat fee.'
        },
        {
          cat: 'pricing',
          q: 'What if we reach the monthly conversation limit?',
          a: 'Open conversations carry on and you keep replying. We e-mail you at 80% of the limit; new conversations open again at the start of the next month.'
        },
        {
          cat: 'setup',
          q: 'Do I need a developer to set it up?',
          a: 'Usually not. On WordPress, Shopify and similar platforms you paste one line into the settings screen. If you get stuck, write to us and we will do it together.'
        },
        {
          cat: 'setup',
          q: 'Which sites does it work on?',
          a: 'Any site you can add one line of HTML to: WordPress, Shopify, Wix, Webflow, or apps built with React, Vue, Angular and Next.js. The guide has copy-ready code for each.'
        },
        {
          cat: 'setup',
          q: 'Will it slow my site down?',
          a: 'No. The bubble starts after the rest of your page has loaded and is isolated from your site’s styles.'
        },
        {
          cat: 'ai',
          q: 'What if the AI assistant says something wrong?',
          a: 'It answers only from your FAQ entries and notes which entry each answer relies on. An answer it cannot back up is never sent; the conversation goes to your team.'
        },
        {
          cat: 'ai',
          q: 'Do we pay extra for the assistant?',
          a: 'No, it is included in every plan. The plans differ in monthly answers and depth: 50 on Free, 1,000 on Pro, 5,000 on Enterprise.'
        },
        {
          cat: 'ai',
          q: 'Is customer data sent to the AI?',
          a: 'No. The visitor’s name, e-mail and earlier messages are not sent, and e-mails and phone numbers in a question are masked. If a card number, IBAN or ID number appears, the question goes to your team without being sent.'
        },
        {
          cat: 'usage',
          q: 'What happens to messages sent out of hours?',
          a: 'Nothing is lost. With the AI assistant on, common questions are answered at once; for the rest we tell the visitor when you will be back and the message waits in your inbox.'
        },
        {
          cat: 'usage',
          q: 'Can I answer from my phone?',
          a: 'Yes. The dashboard works in a phone browser — there is no separate app to install.'
        },
        {
          cat: 'security',
          q: 'Can anyone else see our conversations?',
          a: 'No. Each account’s data is kept within its own boundary, and inside your team every role only sees the screens it is allowed to.'
        },
        {
          cat: 'security',
          q: 'Can I export my data?',
          a: 'On Pro and Enterprise you can export your conversations. The data is yours.'
        }
      ]
    }
  },

  // The bubble on this site is Support.io's own, so the scripts are questions
  // someone would actually ask us — not a made-up shop's parcel trouble.
  demoChat: {
    status: 'Online · usually replies in a few minutes',
    articleName: 'Help article',
    assistantName: 'AI assistant',
    hero: {
      brand: 'Support.io',
      lines: [
        { from: 'visitor', text: 'Hi, my site runs on WordPress. Is setup hard?' },
        {
          from: 'assistant',
          text: 'Not at all! Paste the one line from your dashboard into your site’s footer and you are done.',
          source: 'Source: Setup'
        },
        { from: 'visitor', text: 'Can I talk to someone about pricing?' },
        { from: 'note', text: 'Selin joined the conversation' },
        {
          from: 'agent',
          name: 'Selin',
          text: 'Hi! How big is your team? I will suggest the right plan.'
        }
      ]
    },
    ai: {
      brand: 'Support.io',
      lines: [
        { from: 'note', text: 'Sunday · 23:40' },
        { from: 'visitor', text: 'Is there a discount if I pay yearly?' },
        {
          from: 'assistant',
          text: 'Yes, paying yearly saves 20%. You pick the billing period when you choose your plan.',
          source: 'Source: Plans and pricing'
        },
        { from: 'visitor', text: 'Can I add people to my team later?' },
        {
          from: 'assistant',
          text: 'Of course. Send invitations from the Team screen, up to the users your plan includes.',
          source: 'Source: Team management'
        },
        { from: 'visitor', text: 'Such a quick answer at midnight, great 👏' }
      ]
    },
    story: {
      brand: 'Support.io',
      lines: [
        { from: 'visitor', text: 'How do I add an agent to my team?' },
        {
          from: 'assistant',
          text: 'Go to Team → Invite and enter their e-mail; they join through the link in the invitation.',
          source: 'Source: Team management'
        },
        { from: 'visitor', text: 'How many people fit on Pro? Can I talk to sales?' },
        { from: 'note', text: 'Routed to the Sales department' },
        {
          from: 'agent',
          name: 'Kerem',
          text: 'Hi, Kerem here. Pro takes up to 5 users; for more, let’s talk about Enterprise.'
        }
      ]
    }
  },

  theme: {
    switchToLight: 'Light theme',
    switchToDark: 'Dark theme'
  },

  /* ------------------------------------------------------------- homepage */

  landing: {
    home: {
      metaTitle: 'Support.io — Add live chat to your site',
      metaDesc:
        'Your customers message you from your own site; your team answers from one screen. One line of code. Start on the free plan.',

      btnStart: 'Start free',
      btnDocs: 'Setup guide',

      trust: {
        free: 'Free plan never expires',
        card: 'No credit card required',
        setup: 'Installs in minutes'
      },

      tour: {
        detail: 'See this feature in detail'
      },

      setup: {
        cta: 'Open an account and get the code',
        platforms: [
          'WordPress',
          'Shopify',
          'WooCommerce',
          'Wix',
          'Webflow',
          'Squarespace',
          'Google Tag Manager',
          'React',
          'Next.js',
          'Vue',
          'Angular',
          'Laravel',
          'Django',
          'Magento'
        ]
      },

      /* -------------------------------------------------------- security */
      security: {
        eyebrow: 'Trust',
        title: 'Your customer data stays yours',
        desc: 'A support tool sees everything your customers write to you. So we spell out how we keep it.',
        items: [
          {
            title: 'Your data is kept apart',
            body: 'Every account’s data stays within its own boundary. No other company can see your conversations.'
          },
          {
            title: 'You choose who sees what',
            body: 'Agent, manager and viewer roles are separate. Nobody opens a screen they are not allowed to.'
          },
          {
            title: 'The bubble opens only on your site',
            body: 'You list the addresses it may run on; someone who copies your key onto another site cannot start a chat.'
          },
          {
            title: 'Old records do not pile up forever',
            body: 'Activity logs are cleared automatically after a set period.'
          }
        ]
      },

      /* ------------------------------------------------------------ plans */
      plans: {
        eyebrow: 'Pricing',
        title: 'Start free, move up as you grow',
        desc: 'The free plan has no time limit. Start on your own and change plan when the team grows.',
        link: 'Compare the plans'
      },

      ctaTitle: 'Your first conversation is minutes away',
      ctaDesc: 'Open an account, add your site, paste the line. The rest takes care of itself.',
      ctaBtn1: 'Create a free account',
      ctaBtn2: 'See pricing',
      ctaNote: 'No card required · Leave whenever you like',

      footerDesc:
        'Live chat for your website. Your customer writes, your team answers from one screen.',
      footerStatus: 'System status',
      footerMade: 'Built in Türkiye',
      footerProduct: 'Product',
      footerFeatures: 'Features',
      footerPricing: 'Pricing',
      footerDocs: 'Setup guide',
      footerCompany: 'Company',
      footerAbout: 'About',
      footerSupport: 'Account',
      footerLogin: 'Log in',
      footerRegister: 'Sign up'
    }
  },

  /* -------------------------------------------------------------- features */

  featuresPage: {
    meta: {
      title: 'Features',
      description:
        'Live chat, chat bubble, department routing, automatic rules, proactive messages, help content, reports and team management.'
    },
    eyebrow: 'Product',
    title: 'Everything your support team uses all day',
    description:
      'All of this works today. Not a roadmap — the screens you will find when you open your account.',

    groups: {
      talk: {
        title: 'Where you talk to your customer',
        desc: 'Visitors write from your site and your team answers from a single inbox. Common questions they can look up themselves.',
        points: [
          'Messages appear on your team’s screen as they are typed',
          'Files, screenshots and links can be shared',
          'Returning visitors pick up where they left off',
          'Frequently asked questions are searchable inside the bubble'
        ]
      },
      organize: {
        title: 'Where you decide who does what',
        desc: 'Departments, automatic rules and roles. Answer “who handles this?” once instead of every day.',
        points: [
          'Conversations reach the right department on their own',
          'Repetitive work becomes a rule',
          'Each role sees its own set of screens',
          'Open work is handed on when someone goes offline'
        ]
      },
      grow: {
        title: 'Where you see what happened',
        desc: 'Reports, live visitors and deal tracking. Numbers instead of guesses.',
        points: [
          'Reply and resolution times, broken down per person',
          'Who is on your site right now, and on which page',
          'Sales opportunities that came out of conversations',
          'A returning customer’s history right beside you'
        ]
      }
    },

    benefitsTitle: 'What you get',
    howTitle: 'How to set it up',
    howDesc: 'All from the dashboard, no code. Stuck during setup? Ask us in the chat.',
    nextFeature: 'Next',
    moreTitle: 'Often used together with',
    backToList: 'All features',
    readDocs: 'Read the setup guide',

    devEyebrow: 'Setup',
    devTitle: 'Up and running in minutes',
    devDesc: 'No developer needed. If you get stuck, write to us and we will set it up together.',
    dev: {
      embed: {
        title: 'Copy, paste',
        body: 'Add the one line from your dashboard to your site and the bubble appears.'
      },
      sdk: {
        title: 'On any platform',
        body: 'WordPress, Shopify, Wix, Webflow or React, Vue, Angular — the guide has ready steps for each.'
      },
      isolation: {
        title: 'Never slows your site',
        body: 'The bubble starts after your page has loaded and stays out of your design.'
      },
      control: {
        title: 'In your brand colours',
        body: 'Pick the colour, greeting and position in the dashboard and see it in the preview at once.'
      }
    },

    notFound: {
      title: 'No such feature page',
      body: 'The link may be out of date. Carry on from the list.'
    },

    items: {
      'live-chat': {
        title: 'Live chat',
        short: 'The customer writes, your team sees it instantly.',
        plain:
          'The moment a visitor types in the chat bubble, the message lands on your team’s screen. No refreshing, no waiting.',
        setup: 'Ready to go',
        benefits: [
          'Appears the moment it is typed, with no delay',
          'You see the typing dots while they write',
          'Files and screenshots can be shared',
          'If the connection drops, the message is not lost'
        ],
        steps: [
          {
            title: 'Open your account',
            body: 'Live chat is already on when you sign up; nothing to install.'
          },
          { title: 'Paste the install line', body: 'The bubble starts showing on your site.' },
          {
            title: 'Answer from the dashboard',
            body: 'Keep the inbox open and you will be notified of new messages.'
          }
        ]
      },

      'ai-assistant': {
        title: 'AI assistant',
        short: 'Answers common questions 24/7, in seconds.',
        plain:
          'The moment a visitor asks, the assistant looks for the answer in your own FAQ and replies briefly and clearly. When it does not know, it never makes things up; it hands the conversation to your team.',
        setup: 'One click',
        benefits: [
          'Answers outside working hours too',
          'Relies only on your FAQ, never makes things up',
          'Visitors can reach a person whenever they want',
          'Your team sees which FAQ entry each answer came from'
        ],
        steps: [
          {
            title: 'Write your FAQ',
            body: 'Add your most common questions and answers in the dashboard; the assistant answers from them.'
          },
          { title: 'Switch it on', body: 'Turn it on for your site on the AI Assistant screen.' },
          {
            title: 'Watch the results',
            body: 'See how many questions it answered and why it handed others over; fill the gaps in your FAQ.'
          }
        ]
      },

      'universal-widget': {
        title: 'Chat bubble',
        short: 'One line of code, the same behaviour on every site.',
        plain:
          'You choose the colour, the wording and the position of the bubble in the corner of your site. Whatever your site is built with, it installs with the same single line.',
        setup: 'One line',
        benefits: [
          'Colour, wording and position set from the dashboard',
          'Behaves the same on phones and desktops',
          'Will not break your styling or slow your pages',
          'The same code works on WordPress and on React'
        ],
        steps: [
          { title: 'Add your site', body: 'Register your site address in the dashboard.' },
          {
            title: 'Choose how it looks',
            body: 'Set colour, greeting and position, and check the preview.'
          },
          { title: 'Paste the line', body: 'Adding it to your site template is all it takes.' }
        ]
      },

      routing: {
        title: 'Department routing',
        short: 'Every question reaches the right person.',
        plain:
          'Billing to accounts, sales questions to sales. Define departments once, and new conversations are handed to whoever is free.',
        setup: 'From the dashboard',
        benefits: [
          'Share in turn, or give it to whoever has least on',
          'A cap on how many conversations one person handles at once',
          'Working hours and an out-of-hours message per department',
          'Open work is handed on when someone goes offline'
        ],
        steps: [
          {
            title: 'Define your departments',
            body: 'Sales, support, accounts — whatever fits your business.'
          },
          { title: 'Place your team', body: 'Add each agent to the right department.' },
          {
            title: 'Choose how work is shared',
            body: 'In turn, or to whoever has least on. One setting.'
          }
        ]
      },

      automation: {
        title: 'Automatic rules',
        short: 'Set up repetitive work once.',
        plain:
          'Build rules like “if the message mentions an invoice, send it to accounts and tag it”. When the condition matches, the rule runs itself.',
        setup: 'From the dashboard',
        benefits: [
          'Pick conditions and actions from a list — no code',
          'Tag, route, change priority or send a saved reply',
          'Every run is logged so you can see what happened',
          'Turn any rule off and on whenever you like'
        ],
        steps: [
          { title: 'Pick the condition', body: 'Message content, page, department or status.' },
          {
            title: 'Pick the action',
            body: 'Route it, tag it, raise the priority or send a saved reply.'
          },
          { title: 'Turn it on and watch', body: 'Track how many times the rule has run.' }
        ]
      },

      proactive: {
        title: 'Proactive messages',
        short: 'Reach out before they ask.',
        plain:
          'Send a message on your own to a visitor hesitating on the pricing page or lingering on the same screen. Most people never ask — they just leave.',
        setup: 'From the dashboard',
        benefits: [
          'Trigger on time on page, scrolling, or leaving intent',
          'Show it only on the pages you choose',
          'The same person is not shown it again and again',
          'Every send is recorded'
        ],
        steps: [
          { title: 'Choose the page', body: 'Pricing or sign-up, for example.' },
          { title: 'Choose the trigger', body: 'After how many seconds, or on which behaviour.' },
          { title: 'Write the message', body: 'Short, and offering help, works best.' }
        ]
      },

      'knowledge-base': {
        title: 'Help content',
        short: 'Let the customer find the answer themselves.',
        plain:
          'Write your common questions once and visitors search them inside the chat bubble. When they find the answer themselves, they never write to you.',
        setup: 'From the dashboard',
        benefits: [
          'Instant search inside the bubble',
          'The most-asked appear on the first screen',
          'See how many times each answer was read',
          'Show specific content on specific pages'
        ],
        steps: [
          {
            title: 'Write the first ten',
            body: 'Ask your team what they get asked most and start there.'
          },
          { title: 'Order them', body: 'Put the most-asked at the top.' },
          { title: 'Measure', body: 'Check the read counts and fill in what is missing.' }
        ]
      },

      analytics: {
        title: 'Reports',
        short: 'How fast you replied, how many were resolved.',
        plain:
          'How many questions came in, the average minutes to reply, how many each person closed. You look instead of guessing.',
        setup: 'Ready to go',
        benefits: [
          'First reply and resolution times',
          'A breakdown per person, plus a personal performance screen',
          'Conversations that missed the target shown separately',
          'Calculated for any date range you pick'
        ],
        steps: [
          {
            title: 'Use it for a week',
            body: 'The numbers need a little data before they mean anything.'
          },
          { title: 'Pick the range', body: 'Last 7 days, last 30, or dates of your own.' },
          {
            title: 'Set a target',
            body: 'Set a reply-time target and anything below it is flagged.'
          }
        ]
      },

      team: {
        title: 'Team management',
        short: 'Who sees what, and who is available.',
        plain:
          'Invite your team and pick a role for each of them. See who is online and who is busy.',
        setup: 'From the dashboard',
        benefits: [
          'Owner, admin, manager, agent and viewer roles',
          'Online, away, busy and offline states',
          'Internal chat to ask a colleague without leaving the thread',
          'A screen someone is not allowed to see never appears'
        ],
        steps: [
          { title: 'Send an invite', body: 'Enter an email address and the invite goes out.' },
          { title: 'Pick the role', body: 'The role decides what they can see.' },
          { title: 'Add them to a department', body: 'So conversations start reaching them.' }
        ]
      },

      visitors: {
        title: 'Live visitors',
        short: 'Who is on your site right now, and where.',
        plain:
          'See who is browsing your site at this moment, which page they are on and where they came from — before they write to you.',
        setup: 'Ready to go',
        benefits: [
          'A live list that updates as they move between pages',
          'Where they came from and which browser they use',
          'You notice the one stuck on a page',
          'You know the context before a conversation starts'
        ],
        steps: [
          { title: 'Add the install line', body: 'Visitor tracking comes with the bubble.' },
          { title: 'Open the visitors screen', body: 'The list starts filling on its own.' },
          {
            title: 'Start it yourself if needed',
            body: 'Send a proactive message to a visitor who is stuck.'
          }
        ]
      },

      crm: {
        title: 'Deal tracking',
        short: 'Do not lose the conversations that turn into sales.',
        plain:
          'When a conversation becomes a sales opportunity, open a record for it. Which stage, how much, who owns it — all kept next to the conversation.',
        setup: 'From the dashboard',
        benefits: [
          'Deals listed by stage',
          'Every deal stays linked to the conversation it came from',
          'The owner and the value are tracked',
          'When the customer returns, the history is there'
        ],
        steps: [
          { title: 'Set your stages', body: 'First call, proposal, closing, for example.' },
          {
            title: 'Open a deal from a conversation',
            body: 'One click from the chat that turned into a sale.'
          },
          { title: 'Watch the pipeline', body: 'See how much work is waiting at each stage.' }
        ]
      }
    }
  },

  /* --------------------------------------------------------------- pricing */

  pricingPage: {
    meta: {
      title: 'Pricing',
      description:
        'Start on the free plan. Paid plans are one flat monthly price, not per seat, with nothing hidden.'
    },
    eyebrow: 'Pricing',
    title: 'Start free, move up when your team grows',
    description:
      'The free plan has no time limit and needs no card. The AI assistant is included in every plan; paid plans are a flat monthly price per plan, not per user.',

    billing: 'Billing period',
    monthly: 'Monthly',
    yearly: 'Yearly',
    discount: '{{percent}}% off',
    popular: 'Most popular',
    perMonth: '/ month',
    billedMonthly: 'Billed monthly',
    billedYearly: 'Billed yearly · {{total}} a year',
    custom: 'Custom',
    freeNote: 'Free forever, nothing to bill',
    contactNote: 'Set to fit your needs',
    taxNote: 'VAT is calculated at checkout.',
    loadError: 'The plans could not be loaded just now. Refresh the page to try again.',

    units: {
      sites_one: '{{count}} site',
      sites_other: '{{count}} sites',
      agents_one: '{{count}} user',
      agents_other: '{{count}} users',
      conversations: '{{n}} new conversations a month',
      assistant: '{{n}} AI answers a month',
      assistantDepth: 'Up to {{count}} AI answers per conversation',
      history: '{{period}} of conversation history',
      days_one: '{{count}} day',
      days_other: '{{count}} days',
      years_one: '{{count}} year',
      years_other: '{{count}} years'
    },

    chooseEyebrow: 'Deciding',
    chooseTitle: 'Which plan fits you?',

    compareTitle: 'Plan comparison',
    compareDesc:
      'The table comes from the plan table the server enforces; the limit written here is the limit the dashboard applies.',
    feature: 'Feature',

    faqTitle: 'Questions about pricing',
    faqDesc: 'Anything else on your mind — ask in the chat.',
    faqItems: [
      {
        q: 'How long does the free plan last?',
        a: 'There is no limit. Use it for as long as you like with one site, one user and 100 new conversations a month.'
      },
      {
        q: 'Do I need a credit card?',
        a: 'Not for the free plan. An email and a password is all it takes.'
      },
      {
        q: 'What counts as a “conversation”?',
        a: 'Every new chat a visitor starts is one conversation, however many messages it has. The limit resets at the start of each month, and open conversations carry on when it is reached.'
      },
      {
        q: 'What counts as an “AI answer”?',
        a: 'Every reply the assistant sends a visitor is one answer; handing over to your team does not count. The allowance resets each month, and when it runs out questions go straight to your team.'
      },
      {
        q: 'What counts as a “user”?',
        a: 'Everyone on your team who can sign in, you included; open invitations count too. How many customers you have does not affect the price.'
      },
      {
        q: 'Can I change plan later?',
        a: 'Yes, up or down whenever you like. The change is prorated against your remaining time.'
      },
      {
        q: 'Is VAT included in the price?',
        a: 'VAT is calculated at checkout from your billing details and shown separately on the payment page before you pay.'
      },
      {
        q: 'Is there a commitment?',
        a: 'Not on monthly — leave any month. On yearly, a discounted year is paid up front.'
      },
      {
        q: 'What is different about Enterprise?',
        a: 'More sites, users and conversations; 5,000 AI answers a month with longer, more detailed answers per conversation; audit logs and hands-on setup help.'
      }
    ],

    plans: {
      free: {
        name: 'Free',
        tagline: 'If you are starting on your own, this is enough to start.',
        cta: 'Start free',
        includes: 'What is included',
        forWho: 'Just starting out',
        forWhoBody: 'One site, and you answer the conversations yourself. Start here.',
        extras: ['Chat bubble and appearance settings', 'Help content (FAQ)', 'Reports']
      },
      pro: {
        name: 'Pro',
        tagline: 'If more than one person answers, this is the plan.',
        cta: 'Start with Pro',
        includes: 'Everything in Free, plus',
        forWho: 'Working as a team',
        forWhoBody:
          'With several agents you will want department routing, rules and live visitors.',
        extras: []
      },
      enterprise: {
        name: 'Enterprise',
        tagline: 'For growing teams and the strongest AI experience.',
        cta: 'Start with Enterprise',
        includes: 'Everything in Pro, plus',
        forWho: 'Larger teams',
        forWhoBody:
          'You run many sites and want the AI to handle most questions, with audit records.',
        extras: [
          'More detailed AI answers, wider FAQ coverage',
          'Priority support and hands-on setup help'
        ]
      }
    },

    matrix: {
      sites: 'Sites',
      agents: 'Users',
      conversations: 'New conversations a month',
      history: 'Conversation history',
      widget: 'Chat bubble and appearance',
      faq: 'Help content (FAQ)',
      assistant: 'AI assistant',
      assistantReplies: 'AI answers a month',
      assistantDepth: 'AI answers per conversation',
      analytics: 'Reports',
      departments: 'Departments and routing',
      automation: 'Automatic rules',
      proactive: 'Proactive messages',
      visitors: 'Live visitors',
      crm: 'Deal tracking',
      export: 'Data export',
      audit: 'Audit logs',
      security: 'Two-step verification required for the team',
      integrations: 'Slack, Telegram and webhook notifications',
      noBranding: 'No “Support.io” mark in the bubble'
    }
  },

  /* ----------------------------------------------------------------- about */

  aboutPage: {
    meta: {
      title: 'About',
      description: 'Why Support.io exists and how we make decisions.'
    },
    eyebrow: 'About',
    title: 'A tool a small team built out of its own frustration',
    description:
      'Support.io is not the product of a funding round. It is what a team tired of chasing customer messages across three different places built for itself, and then opened up to others.',

    storyEyebrow: 'The story',
    story: {
      p1: 'We needed a support tool, and everything we looked at either started with an enterprise sales call or surprised us on the first invoice.',
      p2: 'Most of what exists sits at one of two extremes: platforms so large they need a team of their own to set up, or simple chat boxes that stop being enough the moment the team grows. There was nothing in between — something a small team could use on day one and not have to abandon at five people.',
      p3: 'So we wrote it. We run it on our own site first — the chat bubble on this page is the product itself. When something breaks, we are the ones who notice.'
    },

    principlesEyebrow: 'Principles',
    principlesTitle: 'What we decide by',
    principlesDesc:
      'Not slogans on a wall — decisions that shaped the product as it is, including a few that cost us features.',
    principles: {
      own: {
        title: 'Pricing in the open',
        body: 'No form to fill in before you can see a price. The free plan has no time limit and needs no card — we should not need your card for you to try it.'
      },
      plain: {
        title: 'Plain words',
        body: 'We describe what the product does in everyday words. No jargon, no big words, no promises we do not keep.'
      },
      honest: {
        title: 'Nothing we cannot back up',
        body: 'No made-up customer counts, satisfaction scores or logos. We write what the product really does today, the AI assistant included.'
      },
      accessible: {
        title: 'Usable by everyone',
        body: 'Navigable by keyboard, readable by a screen reader, legible in dark mode. Animation switches itself off for anyone who finds motion uncomfortable.'
      }
    },

    contactEyebrow: 'Contact',
    contactBody:
      'A question, a suggestion, or something that is not working for you — write to us. The chat bubble on this site works too; those messages land in the same dashboard.'
  },

  /* -------------------------------------------------------- login / signup */

  authPanel: {
    backHome: 'Back to home',
    login: {
      title: 'Your inbox is waiting',
      points: [
        'Every conversation on one screen',
        'New messages notify you instantly',
        'Works from your phone too'
      ]
    },
    register: {
      title: 'Two minutes from your first message',
      points: [
        'The free plan never expires and needs no card',
        'One line pasted into your site is all it takes',
        'Not for you? Delete your account in one click'
      ]
    }
  },

  login: {
    title: 'Log in',
    subtitle: 'Sign in and get back to your inbox.',
    metaTitle: 'Log in — Support.io',
    noAccount: 'No account yet?',
    register: 'Create one free'
  },

  register: {
    title: 'Create a free account',
    subtitle: 'An email and a password is all it takes. No card required.',
    metaTitle: 'Create a free account — Support.io',
    passwordHint: 'At least 10 characters, not a common one',
    noCard: 'By signing up you accept the terms of use.',
    hasAccount: 'Already have an account?',
    login: 'Log in'
  },

  /* ------------------------------------------------------- product visuals */

  viz: {
    frameGeneric: 'Support.io dashboard',

    inbox: {
      frame: 'Inbox',
      search: 'Search conversations',
      filterOpen: 'Open',
      count: '12 conversations',
      online: 'On site',
      rows: [
        {
          name: 'Ella Kay',
          preview: 'The password reset e-mail never came.',
          time: '2m',
          tag: 'Account',
          tone: 'indigo'
        },
        {
          name: 'Brian Shaw',
          preview: 'Can the invoice be in our company’s name?',
          time: '14m',
          tag: 'Billing',
          tone: 'sky'
        },
        {
          name: 'Zoe A.',
          preview: 'What changes if we switch to yearly?',
          time: '1h',
          tag: 'Sales',
          tone: 'amber'
        },
        {
          name: 'Dennis Yule',
          preview: 'Thanks, all sorted.',
          time: '3h',
          tag: 'Resolved',
          tone: 'emerald'
        }
      ],
      openName: 'Ella Kay',
      openPage: 'on /login',
      openStatus: 'Waiting',
      today: 'Today',
      msg1: 'Hi, I want to reset my password but the e-mail never arrived.',
      msg2: 'Hi Ella! I have sent it again — it should be there in a few minutes. If not, have a look in your spam folder.',
      msg3: 'Got it, thank you!',
      sentBy: 'Kerem',
      composer: 'Write a reply…'
    },

    widget: {
      title: 'Nova Software',
      status: 'Usually replies in a few minutes',
      bot: 'Hi there! How can we help?',
      visitor: 'How long is the trial?',
      agent: '14 days, no card needed. If you get stuck setting up, just write here.',
      quick: ['Pricing', 'Setup', 'Invoices'],
      composer: 'Type your message…'
    },

    assistant: {
      frame: 'AI assistant',
      badge: 'Answered by AI',
      page: 'on /pricing',
      name: 'AI assistant',
      q1: 'How many sites can I add on the free plan?',
      a1: 'The free plan has 1 site and 1 user, with 100 new conversations a month.',
      source: 'Source: Plans and pricing',
      q2: 'Can the invoice be in our company’s name?',
      handoff: 'Not in the FAQ · handed to the team',
      agent: 'Ayça · Accounts',
      a2: 'Hi, Ayça here. Happy to help — what is your company’s registered name?'
    },

    metrics: {
      cards: [
        { value: '38', label: 'Open conversations', delta: '+12%', up: true },
        { value: '2m', label: 'Average first reply', delta: '-18%', up: true },
        { value: '94%', label: 'Resolved', delta: '+3%', up: true },
        { value: '4.8', label: 'Satisfaction', delta: '+0.2', up: true }
      ]
    },

    analytics: {
      frame: 'Reports',
      title: 'Conversations this week',
      range: 'Last 7 days',
      s1: 'Incoming',
      s2: 'Resolved',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      alt: 'Line chart of incoming and resolved conversations over the last seven days.'
    },

    routing: {
      frame: 'Routing',
      visitor: 'New visitor',
      message: '“I would like to know more about Pro”',
      new: 'New',
      depts: [
        { name: 'Sales', load: '2 open' },
        { name: 'Support', load: '5 open' },
        { name: 'Accounts', load: '1 open' }
      ],
      agent: 'Kerem Aslan',
      assigned: 'Assigned · available'
    },

    automation: {
      frame: 'Automatic rules',
      ruleName: 'Billing questions',
      active: 'On',
      ifLabel: 'If',
      and: 'and',
      thenLabel: 'Then',
      conditions: ['Message mentions “invoice”', 'Page is /account'],
      actions: ['Route to Accounts', 'Add the “Billing” tag', 'Send the saved billing reply'],
      stat: 'Ran 128 times this month'
    },

    proactive: {
      frame: 'Proactive message',
      triggers: ['After 30 seconds', 'On leaving intent', 'At the bottom of the page'],
      agent: 'Selin',
      message: 'Not sure which plan fits? Happy to help — how big is your team?'
    },

    knowledge: {
      frame: 'Help content',
      query: 'password',
      results: [
        { q: 'How do I reset my password?', meta: 'Read 412 times' },
        { q: 'How do I change my e-mail address?', meta: 'Read 268 times' },
        { q: 'Where do I download my invoice?', meta: 'Read 193 times' }
      ],
      note: 'A visitor who finds the answer never writes to you.'
    },

    team: {
      frame: 'Team',
      members: [
        {
          name: 'Kerem Aslan',
          role: 'Support · Manager',
          state: 'online',
          stateLabel: 'Online',
          load: '3 open'
        },
        {
          name: 'Selin Duru',
          role: 'Sales · Agent',
          state: 'online',
          stateLabel: 'Online',
          load: '2 open'
        },
        {
          name: 'Mert Yalin',
          role: 'Support · Agent',
          state: 'busy',
          stateLabel: 'Busy',
          load: '5 open'
        },
        { name: 'Ayca Toprak', role: 'Accounts', state: 'away', stateLabel: 'Away', load: '0 open' }
      ]
    },

    visitors: {
      frame: 'Live visitors',
      title: '14 people on your site right now',
      head: ['Location', 'Current page', 'Time'],
      rows: [
        { city: 'Istanbul', page: '/pricing', time: '4m' },
        { city: 'Ankara', page: '/signup', time: '2m' },
        { city: 'Izmir', page: '/help/setup', time: '7m' },
        { city: 'Bursa', page: '/contact', time: '1m' }
      ]
    },

    crm: {
      frame: 'Deal tracking',
      stages: [
        {
          name: 'First call',
          count: '4',
          cards: [
            { title: 'Acme Ltd.', value: '₺24,000' },
            { title: 'Nova Textiles', value: '₺8,500' }
          ]
        },
        { name: 'Proposal', count: '3', cards: [{ title: 'Beta Software', value: '₺46,000' }] },
        {
          name: 'Negotiation',
          count: '2',
          cards: [{ title: 'Kaya Construction', value: '₺112,000' }]
        },
        { name: 'Won', count: '6', cards: [{ title: 'Deniz Foods', value: '₺31,000' }] }
      ]
    }
  },

  compare: {
    eyebrow: 'Comparison',
    title: 'Support.io and {{name}}',
    metaTitle: 'Support.io vs {{name}}',
    whoEyebrow: 'The short answer',
    whoTitle: 'Which one fits you?',
    chooseUs: 'Choose Support.io if',
    chooseThem: '{{name}} may suit you better if',
    tableEyebrow: 'Side by side',
    tableTitle: 'Price and AI',
    tableDesc: 'The Support.io column comes from the plan table the dashboard enforces.',
    rowLabel: 'Topic',
    rows: {
      model: 'Pricing model',
      start: 'Paid plans from',
      free: 'Free plan',
      ai: 'AI'
    },
    us: {
      model: 'A fixed monthly price per plan; you do not pay per user.',
      start: 'Pro: {{price}} a month; {{agents}} and {{sites}} included.',
      free: 'Free forever: {{limits}}.',
      ai: 'Included in every plan at no extra cost: {{free}} answers a month on Free, {{pro}} on Pro.',
      seePricing: 'See the pricing page for current details.'
    },
    checked: '8 October 2026',
    note: 'The {{name}} details were taken from its public pricing page on {{date}}; prices are in US dollars and may have changed since.',
    source: '{{name}} pricing page',
    trademark:
      'The {{name}} name and brand belong to their owner; Support.io is not affiliated with them.',
    gapsEyebrow: 'In fairness',
    gapsTitle: 'What Support.io does not do today',
    gapsDesc: 'Worth knowing before you decide.',
    gaps: [
      'Conversations come from the chat bubble on your website; e-mail, WhatsApp and social media messages do not land in the same inbox.',
      'There is no separate mobile app; the dashboard runs in the browser.',
      'The AI assistant answers only from your site’s FAQ; it does not look up orders or take actions.'
    ],
    othersTitle: 'Other comparisons',
    ctaTitle: 'See the difference on your own site',
    ctaDesc:
      'Open a free account, add the chat bubble to your site and turn the assistant on with your FAQ. No credit card needed.',
    items: {
      'tawk-to': {
        name: 'Tawk.to',
        summary:
          'Both add free live chat to your site. The difference is in AI and in how the price is built: on Tawk.to chat is free while AI and removing the brand line are paid add-ons; on Support.io the assistant is included in every plan and paid plans are a fixed monthly price in Turkish lira.',
        us: [
          'You want the AI assistant included in the plan at no extra cost.',
          'You want to see prices in Turkish lira and pay a fixed monthly amount.',
          'You want the brand line in the chat bubble to go away by itself on a paid plan.'
        ],
        them: [
          'All you need is free live chat and you will not use AI.',
          'You need a large team on the free version.'
        ],
        rows: {
          model: 'Live chat is free; some features are paid add-ons.',
          start: 'Removing “Powered by tawk.to” costs $29 a month.',
          free: 'Yes; live chat, ticketing and a knowledge base are free.',
          ai: 'A separate add-on (AI Assist): a free tier for low-volume sites, the standard plan from $29 a month.'
        }
      },
      crisp: {
        name: 'Crisp',
        summary:
          'Crisp and Support.io both charge per plan, not per person. Crisp gathers many channels in one inbox; Support.io focuses on the chat on your website and an assistant that answers from your FAQ, and is sold in Turkish lira.',
        us: [
          'You want AI answers as a fixed allowance written in the plan, with no credits to track.',
          'You want to try the AI assistant on the free plan too.',
          'You want to see and pay prices in Turkish lira.'
        ],
        them: [
          'Besides web chat, you want e-mail and messaging apps in the same inbox.',
          'You need two people on the free plan.'
        ],
        rows: {
          model:
            'A monthly price per workspace; each plan includes a number of users, extra users $10 a month each.',
          start: 'Mini: $45 a month, 4 users.',
          free: 'Yes: 2 users, up to 100 customer profiles.',
          ai: 'Monthly AI credits on paid plans (about 90 automated conversations on Mini); none on the free plan.'
        }
      },
      intercom: {
        name: 'Intercom',
        summary:
          'Intercom is a broad platform for large support teams: it charges per user, and its AI agent is billed separately for every successful outcome. Support.io is for small and mid-sized teams: a fixed price per plan, with AI answers included.',
        us: [
          'You do not want the bill to grow with every person you add.',
          'You want to know your AI cost in advance rather than pay per outcome.',
          'You want to start on a free plan that does not expire, without a credit card.'
        ],
        them: [
          'You have a large support team and multi-step workflows.',
          'You want support, sales and in-product messages on one platform.'
        ],
        rows: {
          model: 'A monthly price per user (seat).',
          start: 'Essential: from $29 per user a month.',
          free: 'No; a 14-day free trial.',
          ai: 'Fin AI agent: $0.99 per successful outcome.'
        }
      },
      tidio: {
        name: 'Tidio',
        summary:
          'Tidio and Support.io both start with a free plan. On Tidio the price grows with the number of billable conversations and the Lyro AI agent is charged separately; on Support.io AI answers are included in every plan and paid plans are a fixed monthly price in Turkish lira.',
        us: [
          'You want the AI assistant included in the plan at no extra cost.',
          'You want an AI allowance that renews every month on the free plan.',
          'You want to see and pay prices in Turkish lira.'
        ],
        them: [
          'You want to build chat flows with a visual editor on your online shop.',
          'You are looking for ready-made e-commerce platform integrations.'
        ],
        rows: {
          model: 'A monthly price per plan; it grows with billable conversations.',
          start: 'Starter: from $24.17 a month, 100 billable conversations.',
          free: 'Yes: 50 billable conversations a month.',
          ai: 'Lyro AI agent: a one-off allowance of 50 conversations; extra cost after that.'
        }
      }
    }
  }
};
