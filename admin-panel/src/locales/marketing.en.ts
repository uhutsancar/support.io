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
      desc: 'Visitors write from your site; your assistant answers the simple questions at once and hands the rest to your team. Every conversation on one screen, and it is always clear who is on it.',
      tour: 'Tour the product',
      photoAlt: 'Support agent with a headset answering a customer at a computer',
      notifTitle: 'New conversation · /cart',
      notifBody: 'Visitor has been on checkout for 12 seconds',
      handoff: 'Selin took over the conversation'
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
          title: 'The assistant answers first',
          body: 'It answers common questions from your help content and looks up a signed-in customer’s order in your shop’s system. The moment it is unsure, it hands the conversation to a person.',
          chips: ['FAQ', 'Orders', 'Handoff']
        },
        {
          title: 'The rest goes to the right person',
          body: 'Billing to accounts, returns to sales. Define departments once; each conversation goes to whoever is available right now.',
          chips: ['Department', 'Queue', 'Hours']
        },
        {
          title: 'Repeated work becomes a rule',
          body: 'Pick rules like “if the message mentions a refund, tag it and send it to sales” from a list. No code, and every run is logged.',
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
      eyebrow: 'AI',
      title: 'An assistant that runs on your own server and knows when to stop',
      desc: 'The assistant answers your customers from your own help content. The model runs on your machine; conversations and customer data are sent nowhere.',
      points: [
        { title: 'Your data stays home', body: 'The model runs on your server. Not a sentence goes to another company’s AI service.' },
        { title: 'Sensitive data never reaches it', body: 'A customer who types a card, IBAN or ID number is warned and passed straight to a person.' },
        { title: 'Unsure? It hands over', body: 'When the customer asks for a person, complains or information is missing, the conversation goes to your team.' },
        { title: 'It does not make things up', body: 'A reply with a date, price or link that is not in your help content never reaches the customer.' }
      ],
      modes: [
        { name: 'Off', body: 'No assistant; everything is with your team.' },
        { name: 'Copilot', body: 'Suggests summaries and drafts to the agent, never sends.' },
        { name: 'Auto reply', body: 'Answers visitors itself and hands over when needed.' }
      ],
      cta: 'Meet the assistant',
      cta2: 'Feature details'
    },
    setup: {
      eyebrow: 'Setup',
      title: 'One line. Live in minutes.',
      desc: 'The moment you paste it, the bubble is on your site. The rest happens in the dashboard: pick the colour, invite your team, switch the assistant on. No developer needed.',
      keyPlaceholder: 'YOUR_SITE_KEY',
      comment: 'Support.io chat bubble',
      live: 'The bubble shows up within a minute of pasting',
      noDevs: {
        eyebrow: 'No developers',
        title: 'Copy, paste, done.',
        body: 'WordPress, Shopify or a site you built yourself — the same line everywhere, pasted into the settings screen.'
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
        { label: 'Answered by assistant', value: '38%' }
      ]
    },
    features: {
      eyebrow: 'All in one',
      title: 'Eleven features that work today',
      desc: 'Not a roadmap — the screens you will see when you open your account.'
    },
    trustPhotoAlt: 'A small team meeting around a table',
    faq: {
      eyebrow: 'FAQ',
      title: 'Frequently asked questions',
      categories: 'Categories',
      still: 'Still have questions?',
      chat: 'Chat with our team',
      contact: 'Get in touch',
      cat: { all: 'All', pricing: 'Pricing', setup: 'Setup', ai: 'AI', security: 'Security' },
      items: [
        { cat: 'pricing', q: 'Is the free plan really free?', a: 'Yes — no time limit and no credit card. It is limited to one site and one user; conversations are unlimited.' },
        { cat: 'pricing', q: 'What happens when my team grows?', a: 'Move to Pro and pay per user per month. The number of customers or conversations never changes the price.' },
        { cat: 'setup', q: 'Do I need a developer to set it up?', a: 'Usually not. On WordPress, Shopify and similar platforms you paste one line into the settings screen. If you get stuck, write to us and we will do it together.' },
        { cat: 'setup', q: 'Will it slow my site down?', a: 'No. The bubble starts after the rest of your page has loaded and is isolated from your site’s styles.' },
        { cat: 'ai', q: 'What if the assistant says something wrong?', a: 'Every reply is checked before it goes out: if it contains a number, date or link that is not in your help content, it is not sent and a person takes over.' },
        { cat: 'ai', q: 'Do we pay extra for the assistant?', a: 'No. The model runs on your server, so there is no per-question fee. What you need is a graphics card with roughly 12–16 GB of memory.' },
        { cat: 'security', q: 'Can anyone else see our conversations?', a: 'No. Each account’s data is kept within its own boundary, and inside your team every role only sees the screens it is allowed to.' },
        { cat: 'security', q: 'Can I export my data?', a: 'On Pro and Enterprise you can export your conversations. The data is yours.' }
      ]
    }
  },

  demoChat: {
    status: 'Online · usually replies in a few minutes',
    botName: 'Assistant',
    hero: {
      brand: 'Acme Store',
      lines: [
        { from: 'visitor', text: 'Hi, how many days do I have to return something?' },
        { from: 'bot', text: 'You can return it free of charge within 14 days of delivery. An opened box is fine.' },
        { from: 'visitor', text: 'Can I talk to someone?' },
        { from: 'note', text: 'Selin joined the conversation' },
        { from: 'agent', name: 'Selin', text: 'Hi! I’m Selin, happy to help.' }
      ]
    },
    story: {
      brand: 'Acme Store',
      lines: [
        { from: 'visitor', text: 'Where is my parcel? Order 10482' },
        { from: 'order', order: { number: '10482', status: 'Shipped', carrier: 'Example Cargo', eta: 'Expected Thursday' } },
        { from: 'bot', text: 'Your order was shipped yesterday and should arrive on Thursday.' },
        { from: 'visitor', text: 'I need to change my address' },
        { from: 'note', text: 'The assistant handed over to the team' },
        { from: 'agent', name: 'Kerem', text: 'I’m updating your address with the carrier right now.' }
      ]
    },
    ai: {
      brand: 'Acme Store',
      lines: [
        { from: 'visitor', text: 'Hello 👋' },
        { from: 'bot', text: 'Hi! Ask me about your order, returns or our products.' },
        { from: 'visitor', text: 'What’s the status of my last order?' },
        { from: 'order', order: { number: '10482', status: 'Shipped', carrier: 'Example Cargo', eta: 'Expected Thursday' } },
        { from: 'bot', text: 'Order 10482 is on its way and should arrive on Thursday.' },
        { from: 'visitor', text: 'Looks like my card was charged twice' },
        { from: 'note', text: 'Payment issue · passed to an agent' },
        { from: 'agent', name: 'Selin', text: 'Checking now — could you tell me the amount on your statement?' }
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
        'Your customers message you from your own site; your team answers from one screen. One line of code, two minutes. Start on the free plan.',

      badge: '2-minute setup · No card required',
      heroTitle: 'Be there when your customer',
      heroTitleAccent: 'asks.',
      heroDesc:
        'Let people browsing your site ask you a question the moment it occurs to them. Your team sees every conversation on one screen, so nothing goes unanswered. One line to install, and as familiar to use as WhatsApp.',

      btnStart: 'Start free',
      btnTour: 'See what it does',
      btnDocs: 'Setup guide',

      trust: {
        free: 'Free plan never expires',
        card: 'No credit card required',
        setup: 'Around 2 minutes to install'
      },

      /* --------------------------------------------------------- problem */
      problem: {
        eyebrow: 'Sound familiar',
        title: 'Customer messages are scattered everywhere',
        desc: 'One writes on Instagram, another calls, another fills in the contact form. Whoever is answering loses track of which is which, and nobody notices the one that never got a reply.',
        items: [
          {
            title: 'Messages get lost',
            body: 'A question sitting in an inbox becomes a question nobody answered, on a busy day.'
          },
          {
            title: 'Nobody knows who did what',
            body: 'Two people answer the same customer while a third assumes it was never picked up.'
          },
          {
            title: 'Replies come too late',
            body: 'A visitor ready to buy waits for an answer, closes the tab, and does not come back.'
          },
          {
            title: 'You cannot measure it',
            body: 'How many questions came in, how fast you replied, how many were resolved — no number anywhere.'
          }
        ],
        answer:
          'Support.io puts all of it in one inbox. Who asked, from which page, what they asked, who answered — on one screen.'
      },

      /* ------------------------------------------------------- how it works */
      how: {
        eyebrow: 'How it works',
        title: 'Four steps to a support line that works on day one',
        desc: 'You do not need technical knowledge to set it up. Here is what happens, in order.'
      },

      steps: [
        {
          kicker: 'Visitor side',
          title: 'A chat bubble appears in the corner of your site',
          body: 'A visitor clicks and types. No sign-up, no email required. You choose the colour, the greeting and where it sits, so it looks like part of your site.',
          points: [
            'Works the same on phones and desktops',
            'The conversation stays open as they move between pages',
            'When they come back, they find it where they left off'
          ]
        },
        {
          kicker: 'Team side',
          title: 'The message lands on your team’s screen instantly',
          body: 'No refreshing. The message appears as it is typed, alongside the page the customer is on, what you talked about before, and who is already handling it.',
          points: [
            'You see the typing dots as they write',
            'Files and screenshots can be shared both ways',
            'Ask a colleague without leaving the conversation'
          ]
        },
        {
          kicker: 'Organisation',
          title: 'Each conversation reaches the right person on its own',
          body: 'Billing questions to accounts, returns to sales. Define your departments once, and every new conversation goes to whoever is free.',
          points: [
            'Share the load in turn, or give it to whoever has least',
            'Automatic notice outside working hours',
            'When someone goes offline, their open work is handed on'
          ]
        },
        {
          kicker: 'Outcome',
          title: 'At the end of the month you see the numbers',
          body: 'How many came in, the average minutes to first reply, how many each person closed. You look instead of guessing.',
          points: [
            'First reply time and time to resolve',
            'A breakdown per team member',
            'Which pages generate the most questions'
          ]
        }
      ],

      /* ----------------------------------------------------------- tabs */
      tour: {
        eyebrow: 'Product tour',
        title: 'What is inside the dashboard',
        desc: 'Click through — each one is a screen your team uses during the day.',
        detail: 'See this feature in detail'
      },

      /* ------------------------------------------------------- use cases */
      cases: {
        eyebrow: 'Who uses it',
        title: 'Same product, a different job depending on yours',
        desc: 'Pick the one closest to your business.',
        items: {
          ecommerce: {
            name: 'Online shops',
            tag: 'Shipping, returns, sizing',
            headline: 'Let the customer at checkout ask, so the order does not slip away',
            body: 'Someone asking “do you have this in medium?” or “when does it ship?” on a product page cannot wait. The chat opens right there, and your agent answers while seeing exactly which product they are looking at. Set up saved replies for the shipping and returns questions you answer thirty times a day.',
            wins: [
              {
                label: 'Fewer abandoned carts',
                body: 'A visitor stuck at checkout gets a message without being asked.'
              },
              {
                label: 'Repeat questions stop',
                body: 'Shipping and returns answered instantly with a saved reply.'
              },
              {
                label: 'Context is already there',
                body: 'The page they are on and your past conversations sit beside the chat.'
              }
            ]
          },
          saas: {
            name: 'Software / SaaS',
            tag: 'Trials, setup, errors',
            headline: 'Catch the trial user who gets stuck before they quietly leave',
            body: 'Someone new to your product usually does not ask when they hit a wall — they just leave. You can message a user who stalls on a screen or lingers in the setup step. Every question lands with the right team, so technical ones do not sit with support.',
            wins: [
              {
                label: 'You see the silent churn',
                body: 'Who is on which screen, and for how long, live in the dashboard.'
              },
              {
                label: 'The right team picks it up',
                body: 'Billing to accounts, bug reports to engineering.'
              },
              {
                label: 'Answers accumulate',
                body: 'Common questions become help content people find themselves.'
              }
            ]
          },
          agency: {
            name: 'Agencies / Many sites',
            tag: 'Client sites, separate teams',
            headline: 'Run several sites from one dashboard without mixing the data',
            body: 'Each site you manage gets its own install line. Conversations, team members and reports stay separated per site, so one client’s data never shows up in another’s. You decide which team member can reach which site.',
            wins: [
              {
                label: 'Separated per site',
                body: 'Each site keeps its own conversations and reports.'
              },
              { label: 'Access is yours to set', body: 'Pick exactly who can see which site.' },
              { label: 'One login', body: 'No more one dashboard per client.' }
            ]
          },
          service: {
            name: 'Services / Bookings',
            tag: 'Clinics, studios, consulting',
            headline: 'Take in writing everything people currently phone you about',
            body: 'Booking, pricing and directions tie up the phone. When the same questions arrive by chat, one person can help several people at once. Messages that arrive out of hours are not lost; they wait for you, and the customer knows when you will be back.',
            wins: [
              {
                label: 'The phone frees up',
                body: 'Handle several conversations at the same time.'
              },
              {
                label: 'Nothing lost after hours',
                body: 'A message sent at night is in your inbox in the morning.'
              },
              { label: 'Common answers ready', body: 'Pricing and address answered in one click.' }
            ]
          }
        }
      },

      /* ----------------------------------------------------------- setup */
      setup: {
        eyebrow: 'Setup',
        title: 'One line of code, two minutes',
        desc: 'Once your account is open we give you a line of your own. Send it to whoever looks after your site and they paste it in. That is the whole job.',
        steps: [
          { title: 'Open your account', body: 'An email and a password is all it takes. No card.' },
          { title: 'Add your site', body: 'Enter your address and we give you your install line.' },
          {
            title: 'Paste the line into your site',
            body: 'The bubble shows up on your site within the minute.'
          }
        ],
        file: 'your site’s page',
        cta: 'Open an account and get the line',
        note: 'No one to do it for you? Send us your address and we will set it up together.',
        worksWith: 'Works on whatever your site is built with',
        platforms: [
          'WordPress',
          'Shopify',
          'WooCommerce',
          'Wix',
          'Webflow',
          'Squarespace',
          'BigCommerce',
          'React',
          'Next.js',
          'Vue',
          'Laravel',
          'PHP',
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
            title: 'It will not break or slow your site',
            body: 'The chat bubble is isolated from your site’s styling and cannot change how your pages look.'
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
        price: { free: '₺0', pro: '₺490', enterprise: 'Custom' },
        note: {
          free: 'One site, one user',
          pro: 'Per user / month',
          enterprise: 'For larger teams'
        },
        link: 'Compare the plans'
      },

      /* -------------------------------------------------------------- FAQ */
      faq: {
        title: 'Common questions',
        desc: 'Anything else — just ask in the chat. This site runs the same product.',
        items: [
          {
            q: 'Do I need a developer to install it?',
            a: 'Usually not. On WordPress, Shopify and similar platforms you paste one line in the settings screen. If you get stuck, send us your address and we will do it together.'
          },
          {
            q: 'Is the free plan really free?',
            a: 'Yes, with no time limit and no card. It covers one site and one user, with unlimited conversations.'
          },
          {
            q: 'Will it slow my site down?',
            a: 'No. The chat bubble loads after the rest of your page, so it never holds your site up.'
          },
          {
            q: 'What happens to messages sent out of hours?',
            a: 'Nothing is lost. We tell the visitor when you will be back and the message waits in your inbox.'
          },
          {
            q: 'Can I answer from my phone?',
            a: 'Yes. The dashboard works in a phone browser — there is no separate app to install.'
          },
          {
            q: 'Can I take my data out?',
            a: 'On Pro and Enterprise you can export your conversations. The data is yours; if you leave, you take it with you.'
          }
        ]
      },

      ctaTitle: 'Your first conversation is two minutes away',
      ctaDesc: 'Open an account, add your site, paste the line. The rest takes care of itself.',
      ctaBtn1: 'Create a free account',
      ctaBtn2: 'See pricing',
      ctaNote: 'No card required · Leave whenever you like',

      footerDesc:
        'Live chat for your website. Your customer writes, your team answers from one screen.',
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
        desc: 'Reports, live visitors, deal tracking and the AI assistant. Numbers instead of guesses.',
        points: [
          'Reply and resolution times, broken down per person',
          'Who is on your site right now, and on which page',
          'Sales opportunities that came out of conversations',
          'Summaries of long threads and suggested replies'
        ]
      }
    },

    benefitsTitle: 'What you get',
    howTitle: 'How to set it up',
    howDesc: 'All from the dashboard, no code. Stuck during setup? Ask us in the chat.',
    techTitle: 'Technical note — for those who want to know how it works',
    nextFeature: 'Next',
    moreTitle: 'Often used together with',
    backToList: 'All features',
    readDocs: 'Read the setup guide',

    devEyebrow: 'For developers',
    devTitle: 'If you do have a developer, it gets easier still',
    devDesc:
      'Integration is one line, not a project. And there is an interface for teams that want more.',
    dev: {
      embed: {
        title: 'The same single line everywhere',
        body: 'Plain HTML, React, Next.js, Vue, WordPress, Laravel — the same code on all of them. No platform-specific install.'
      },
      sdk: {
        title: 'Control it from code',
        body: 'Open and close the bubble, identify the signed-in user, switch language or theme — all from your own code.'
      },
      isolation: {
        title: 'It will not break your styling',
        body: 'The bubble runs in its own isolated area. Your CSS cannot reach it and its CSS cannot reach your site.'
      },
      control: {
        title: 'You can pin the version',
        body: 'Choose to stay on a specific version so a future update cannot change your live site.'
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
          'Billing to accounts, returns to sales. Define departments once, and new conversations are handed to whoever is free.',
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
          'Build rules like “if the message mentions a return, send it to sales and tag it”. When the condition matches, the rule runs itself.',
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
          'Send a message on your own to a visitor stuck on the payment page or lingering on the same screen. Most people never ask — they just leave.',
        setup: 'From the dashboard',
        benefits: [
          'Trigger on time on page, scrolling, or leaving intent',
          'Show it only on the pages you choose',
          'The same person is not shown it again and again',
          'Every send is recorded'
        ],
        steps: [
          { title: 'Choose the page', body: 'Checkout or pricing, for example.' },
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

      'ai-assist': {
        title: 'AI assistant',
        short: 'Answers the simple questions, hands the rest to your team.',
        plain:
          'The assistant answers common questions from your help content, looks up a signed-in customer’s order in your shop’s system, and leaves the conversation to your team the moment it is unsure. The model runs on your own server.',
        setup: 'On your server',
        benefits: [
          'Auto reply: greetings, FAQ and order status',
          'Hands over the moment the customer asks, or on a complaint',
          'Summary, draft reply, tone and translation for agents',
          'Conversations and customer data never leave your server'
        ],
        steps: [
          { title: 'Start the model on your server', body: 'One command on a GPU server; the dashboard notices by itself when it is ready.' },
          { title: 'Choose the mode per site', body: 'Sites → AI settings: off, copilot or automatic replies.' },
          { title: 'Fill in your help content', body: 'The assistant only says what is written there; the better the content, the better the answer.' }
        ],
        body: 'The model runs in one server container that the backend reaches over the internal network only; there is no fallback to any hosted model. A visitor message is first checked in code (a request for a person, card/IBAN/ID numbers, the reply budget), then sent to the model with only the matching FAQ entries. Numbers, dates and links in the answer are checked against those sources; an answer that fails is not sent and a person takes over.',
        points: [
          'Automatic replies stop the moment an agent takes over',
          'Orders are looked up only for a verified customer, with a signed request',
          'If the model is down or busy, the conversation goes to a person without waiting'
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
        ],
        body: 'Deal records are kept within the same organisation boundary as conversations and stay linked to the conversation they were opened from. Stage, value and owner are edited from the dashboard, and every change is written to the audit log.',
        points: [
          'Deals stay linked to the conversation they came from',
          'Stage and value changes are recorded',
          'Records are isolated to the organisation'
        ]
      }
    }
  },

  /* --------------------------------------------------------------- pricing */

  pricingPage: {
    meta: {
      title: 'Pricing',
      description: 'Start on the free plan. Priced per user per month, with nothing hidden.'
    },
    eyebrow: 'Pricing',
    title: 'Start free, pay as your team grows',
    description:
      'The free plan has no time limit and needs no card. Paid plans are per user per month — no surprise line items.',

    billing: 'Billing period',
    monthly: 'Monthly',
    yearly: 'Yearly',
    discount: '2 months free',
    popular: 'Most popular',
    perSeat: '/ user / month',
    billedMonthly: 'Billed monthly',
    billedYearly: 'Billed yearly',
    custom: 'Custom',
    freeNote: 'Free forever, nothing to bill',
    contactNote: 'Set to fit your needs',
    vatNote: 'Prices exclude VAT. Change plan or leave whenever you like.',

    chooseEyebrow: 'Deciding',
    chooseTitle: 'Which plan fits you?',

    compareTitle: 'Plan comparison',
    compareDesc:
      'The table below reflects the screens that are actually unlocked in the dashboard.',
    feature: 'Feature',

    faqTitle: 'Questions about pricing',
    faqDesc: 'Anything else on your mind — ask in the chat.',
    faqItems: [
      {
        q: 'How long does the free plan last?',
        a: 'There is no limit. Use it indefinitely with one site and one user. We do not cap the number of conversations.'
      },
      {
        q: 'Do I need a credit card?',
        a: 'Not for the free plan. An email and a password is all it takes.'
      },
      {
        q: 'Can I change plan later?',
        a: 'Yes, up or down whenever you like. The change is prorated against your remaining time.'
      },
      {
        q: 'What counts as a “user”?',
        a: 'Anyone on your team who signs in and answers conversations. How many customers you have does not affect the price.'
      },
      {
        q: 'Is there a commitment?',
        a: 'Not on monthly — leave any month. The yearly plan is paid up front, which is why two months are free.'
      },
      {
        q: 'What is different about Enterprise?',
        a: 'Unlimited sites, audit logs and single sign-on. We work out the scope with you.'
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
        features: [
          '1 site',
          '1 user',
          'Unlimited conversations',
          'Chat bubble and appearance settings',
          'Help content (FAQ)',
          'Automatic rules',
          'Proactive messages',
          'AI assistant (on your own server)'
        ]
      },
      pro: {
        name: 'Pro',
        tagline: 'If more than one person answers, this is the plan.',
        cta: 'Start with Pro',
        includes: 'Everything in Free, plus',
        forWho: 'Working as a team',
        forWhoBody: 'With several agents you will want reports and department routing.',
        features: [
          '10 sites',
          'Unlimited users',
          'Departments and routing rules',
          'Reports and agent performance',
          'Live visitors',
          'Deal tracking',
          'Data export'
        ]
      },
      enterprise: {
        name: 'Enterprise',
        tagline: 'For many sites and stricter access rules.',
        cta: 'Talk to us',
        includes: 'Everything in Pro, plus',
        forWho: 'Larger teams',
        forWhoBody: 'You run many sites and need audit and access records.',
        features: [
          'Unlimited sites',
          'Audit logs',
          'Single sign-on (SSO)',
          'Hands-on setup support'
        ]
      }
    },

    matrix: {
      sites: 'Sites',
      agents: 'Users',
      conversations: 'Unlimited conversations',
      widget: 'Chat bubble and appearance',
      faq: 'Help content (FAQ)',
      departments: 'Departments',
      automation: 'Automatic rules',
      proactive: 'Proactive messages',
      analytics: 'Reports',
      visitors: 'Live visitors',
      crm: 'Deal tracking',
      aiAssist: 'AI assistant (on your own server)',
      export: 'Data export',
      audit: 'Audit logs',
      sso: 'Single sign-on (SSO)'
    }
  },

  /* ----------------------------------------------------------------- about */

  aboutPage: {
    meta: {
      title: 'About',
      description: 'Why Support.io exists, what it was built around, and what it is built on.'
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
        body: 'You will not find “AI-powered omnichannel solution” on this site. We describe what the product does in everyday words, and put the technical wording where the people who want it will look.'
      },
      honest: {
        title: 'Nothing we cannot back up',
        body: 'No customer counts, no satisfaction scores, no logos of companies that do not use us. Earlier versions of this site had all three. They were removed, because none of them had data behind them.'
      },
      accessible: {
        title: 'Usable by everyone',
        body: 'Navigable by keyboard, readable by a screen reader, legible in dark mode. Animation switches itself off for anyone who finds motion uncomfortable.'
      }
    },

    stackEyebrow: 'What it runs on',
    stackNote:
      'For the curious. You do not need to know any of this — using the product touches none of it.',
    stack: {
      frontend: 'The dashboard and this site',
      backend: 'The server side',
      db: 'Where the data lives',
      realtime: 'Delivering messages instantly',
      storage: 'Shared files',
      widget: 'The chat bubble, isolated from your site'
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
    passwordHint: 'At least 6 characters',
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
          preview: 'When will my order ship?',
          time: '2m',
          tag: 'Shipping',
          tone: 'indigo'
        },
        {
          name: 'Brian Shaw',
          preview: 'Could you update my invoice?',
          time: '14m',
          tag: 'Billing',
          tone: 'sky'
        },
        {
          name: 'Zoe A.',
          preview: 'Do you have this in a medium?',
          time: '1h',
          tag: 'Product',
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
      openPage: 'on /track-order',
      openStatus: 'Waiting',
      today: 'Today',
      msg1: 'Hi, the order I placed yesterday still says preparing. When does it go out?',
      msg2: 'Hi Ella! I have checked your order — it ships today before 5pm. Your tracking number will arrive by text.',
      msg3: 'Great, thank you!',
      sentBy: 'Kerem',
      composer: 'Write a reply…'
    },

    widget: {
      title: 'Acme Store',
      status: 'Usually replies in a few minutes',
      bot: 'Hi there! How can we help?',
      visitor: 'When will my order arrive?',
      agent: 'We ship same day, and delivery takes 1–3 working days.',
      quick: ['Track order', 'Returns', 'Invoice'],
      composer: 'Type your message…'
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
      message: '“I would like to return this”',
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
      ruleName: 'Return request',
      active: 'On',
      ifLabel: 'If',
      and: 'and',
      thenLabel: 'Then',
      conditions: ['Message mentions “return”', 'Page is /my-orders'],
      actions: ['Route to Sales', 'Add the “Return” tag', 'Send the saved returns reply'],
      stat: 'Ran 128 times this month'
    },

    proactive: {
      frame: 'Proactive message',
      triggers: ['After 30 seconds', 'On leaving intent', 'At the bottom of the page'],
      agent: 'Selin',
      message:
        'If you are stuck at the payment step, let me help — which card would you like to use?'
    },

    knowledge: {
      frame: 'Help content',
      query: 'when does it ship',
      results: [
        { q: 'When will my order ship?', meta: 'Read 412 times' },
        { q: 'Where do I find my tracking number?', meta: 'Read 268 times' },
        { q: 'How long does delivery take?', meta: 'Read 193 times' }
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
        { city: 'Istanbul', page: '/product/winter-coat', time: '4m' },
        { city: 'Ankara', page: '/cart', time: '2m' },
        { city: 'Izmir', page: '/track-order', time: '7m' },
        { city: 'Bursa', page: '/contact', time: '1m' }
      ]
    },

    ai: {
      frame: 'AI assistant',
      incoming: 'Incoming message',
      question: 'I want to return this but I threw the box away — do you still accept it?',
      suggestion: 'Suggested reply',
      draft:
        'Hi! We accept returns without the original box, as long as the item is unused. I can send you the return code right away.',
      actions: ['Send', 'Edit', 'Soften tone'],
      note: 'The suggestion is always shown to you and never reaches the customer unapproved.'
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
  }
};
