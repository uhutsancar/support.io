/**
 * Account security, sign-up and trial copy (English). Mirrors account.tr.ts.
 */

export default {
  account: {
    register: {
      checkInboxTitle: 'Check your inbox',
      checkInboxBody:
        'We sent a verification link to {{email}}. Opening it opens your account and takes you to the setup.',
      checkInboxHint: 'If it has not arrived in a few minutes, look in your spam folder.',
      resend: 'Send the link again',
      resent: 'The link was sent again.',
      otherAddress: 'Sign up with another address',
      trialNote: 'Pro features free for 14 days; no credit card needed.',
      securityCheck: 'Loading the security check…'
    },
    login: {
      notVerified:
        'Your e-mail address is not verified yet. We can send you a new verification link.',
      sendLink: 'Send the verification link',
      linkSent: 'The verification link is on its way. Check your inbox.',
      mfaTitle: 'Two-step verification',
      mfaSubtitle: 'Enter the 6-digit code from your authenticator app.',
      mfaRecoverySubtitle: 'Enter one of the recovery codes you saved. Each code works once.',
      code: 'Verification code',
      recoveryCode: 'Recovery code',
      useRecovery: 'I cannot reach my phone, use a recovery code',
      useApp: 'Use the code from the app',
      verify: 'Verify',
      startOver: 'Start over'
    },
    verify: {
      signedIn: 'Your e-mail address is verified. Taking you to your account…',
      done: 'Your e-mail address is verified. You can sign in now.'
    },
    confirmEmail: {
      title: 'New e-mail address',
      working: 'Confirming the address…',
      done: 'Your e-mail address has changed. Sign in with {{email}} from now on.',
      failed:
        'This link is invalid or has expired. You can ask for a new one on the settings page.',
      taken: 'This address can no longer be used. Try another one.'
    },
    security: {
      title: 'Account security',
      description:
        'Manage your password, your e-mail address and the second step asked at sign-in.',
      password: {
        title: 'Password',
        current: 'Current password',
        next: 'New password',
        confirm: 'New password (again)',
        hint: 'At least 10 characters. Saving it signs you out on every other device.',
        save: 'Change password',
        changed: 'Your password has changed. You were signed out on every other device.',
        mismatch: 'The new passwords do not match'
      },
      email: {
        title: 'E-mail address',
        current: 'Current address: {{email}}',
        next: 'New e-mail address',
        password: 'Your password',
        send: 'Send a confirmation link',
        sent: 'A confirmation link was sent to the new address. Your current address stays in use until it is opened.'
      },
      sessions: {
        title: 'Open sessions',
        body: 'If you left your account signed in on another computer or phone, end every session there. You stay signed in on this browser.',
        button: 'Sign out of every other device',
        done: 'Every other session has been ended.'
      },
      mfa: {
        title: 'Two-step verification',
        body: 'Signing in asks for a code from the authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password and the like) as well as your password.',
        on: 'On',
        off: 'Off',
        enable: 'Turn on two-step verification',
        disable: 'Turn off',
        passwordPrompt: 'Enter your password to continue',
        continue: 'Continue',
        scan: 'Scan this QR code with your authenticator app.',
        manual: 'If you cannot scan it, enter this key by hand:',
        codeLabel: 'The 6-digit code from the app',
        confirm: 'Verify and turn on',
        recoveryTitle: 'Your recovery codes',
        recoveryBody:
          'If you cannot reach your phone, these codes sign you in. Each works once. Save them somewhere safe now: they will not be shown again.',
        copy: 'Copy',
        copied: 'Copied',
        download: 'Download',
        saved: 'I saved them',
        enabled: 'Two-step verification is on.',
        disabled: 'Two-step verification is off.',
        disableBody:
          'To turn it off, enter your password and the current code from the app (or a recovery code).',
        recoveryLeft: '{{count}} recovery codes left.',
        regenerate: 'Create new recovery codes',
        regenerateBody: 'Once you create new codes, none of the old ones work.',
        enforcedNote:
          'Your organization requires two-step verification, so it cannot be turned off.'
      },
      enforce: {
        title: 'Require it for the whole team',
        body: 'While on, members without two-step verification cannot use the rest of the panel until they set it up.',
        enterpriseOnly: 'Available on the Enterprise plan.',
        turnOn: 'Require it',
        turnOff: 'Stop requiring it',
        updated: 'Team security setting saved.'
      },
      required: {
        title: 'Your organization requires two-step verification',
        body: 'Turn on two-step verification for your account to continue to the panel. It takes a couple of minutes.'
      }
    },
    chatSettings: {
      button: 'Chat settings',
      title: 'Chat settings',
      saved: 'Chat settings saved.',
      save: 'Save',
      missedTitle: 'Unanswered chats',
      missedHelp:
        'When a visitor writes and nobody answers within the time you set (or nobody is online), the team gets an e-mail.',
      delay: 'Wait (minutes)',
      notify: 'Who hears about it',
      notifyAll: 'Everyone who works on the site',
      notifyAssigned: 'The assigned agent (everyone when unassigned)',
      notifyOff: 'Nobody',
      offlineForm: 'Ask for an e-mail while offline',
      offlineFormHelp:
        'While nobody is online, the bubble asks the visitor for an address to send the answer to.',
      emailReplies: 'E-mail replies to visitors who left',
      emailRepliesHelp:
        'When the visitor left an address and has gone, agents’ replies go by e-mail with a link back to the chat.',
      preChatTitle: 'Pre-chat form',
      preChatMode: 'Form',
      modeOff: 'Off',
      modeOptional: 'Optional',
      modeRequired: 'Required',
      fieldName: 'Name',
      fieldEmail: 'E-mail',
      fieldPhone: 'Phone',
      customFields: 'Extra questions (up to 3, one per line)',
      consentTitle: 'Privacy notice consent',
      consentMode: 'Consent box',
      policyUrl: 'Address of your privacy notice',
      policyUrlHelp:
        'The link next to the box opens this page. The time the visitor consented is kept with the conversation.',
      csatTitle: 'Satisfaction rating',
      csatEnabled: 'Ask for a rating when the chat ends',
      csatStyle: 'Style',
      styleThumbs: 'Thumbs up / down',
      styleStars: '1–5 stars',
      csatEmail: 'Ask by e-mail when the visitor left without rating',
      transcript: 'Let visitors have the transcript e-mailed',
      spamMode: 'Spam protection',
      spamModeHelp:
        'Visitors nobody has answered yet can send at most 3 messages a minute and one message with a link every 5 minutes. Messages with many links, or the same text repeated, are always tagged “spam”.'
    },
    notifications: {
      title: 'Notifications',
      description: 'Choose how you hear about new and unanswered chats.',
      missedEmail: 'Unanswered-chat e-mails',
      instant: 'At once (grouped every 10 minutes)',
      hourly: 'Hourly digest',
      off: 'Off',
      desktopTitle: 'Desktop notifications',
      desktopHelp: 'Shown by the browser while the panel is in the background.',
      allow: 'Allow notifications',
      allowed: 'Allowed in this browser.',
      blocked: 'Notifications are blocked in this browser. You can allow them in its settings.',
      newConversation: 'New conversation',
      assigned: 'Conversation assigned to me',
      allMessages: 'Every new message',
      sound: 'Notification sound',
      activation: 'Account set-up e-mails (first month)',
      language: 'Language of e-mails',
      saved: 'Notification preferences saved.'
    },
    rating: {
      title: 'Rate the conversation',
      subtitle: 'How was your chat with {{site}}?',
      up: 'Good',
      down: 'Not good',
      star: '{{n}} stars',
      feedback: 'Anything you would like to add? (optional)',
      send: 'Send',
      thanks: 'Thank you for your rating!',
      already: 'You have rated this chat already. Thank you!',
      invalid: 'This link is invalid or has expired.',
      low: 'Low rating',
      label: 'Satisfaction'
    },
    trial: {
      banner: '{{count}} days left in your Pro trial.',
      lastDay: 'Your Pro trial ends today.',
      choose: 'Choose a plan',
      label: 'Free trial',
      billingNote:
        'Pro trial until {{date}}. We never asked for a card; nothing is charged automatically.'
    },
    errors: {
      PASSWORD_TOO_SHORT: 'The password must be at least 10 characters.',
      PASSWORD_TOO_LONG: 'The password is too long.',
      PASSWORD_TOO_COMMON: 'This password is too common; choose one that is hard to guess.',
      PASSWORD_CONTAINS_EMAIL: 'The password must not contain your e-mail address.',
      PASSWORD_REQUIRED: 'A password is required.',
      PASSWORD_UNCHANGED: 'The new password cannot be the same as the current one.',
      EMAIL_DISPOSABLE: 'Please use a permanent e-mail address.',
      EMAIL_INVALID: 'Enter a valid e-mail address.',
      EMAIL_UNCHANGED: 'This is already your address.',
      CAPTCHA_FAILED: 'The security check could not be completed, please try again.',
      MFA_CODE_INVALID: 'The code is not correct.',
      MFA_EXPIRED: 'The sign-in has expired, please start again.',
      MFA_ENFORCED: 'Your organization requires two-step verification.',
      MFA_REQUIRED_FIRST: 'Turn on two-step verification for your own account first.',
      TOO_MANY_ACCOUNT_CHANGES: 'Too many change attempts. Try again in an hour.',
      TOO_MANY_MFA_ATTEMPTS: 'Too many code attempts. Sign in again a little later.',
      INVALID_TOKEN: 'This link is invalid or has expired.'
    }
  },
  overage: {
    title: 'What is over your plan is on hold',
    description:
      'Your plan includes {{sites}} sites and a team of {{agents}}. The rest is on hold: sites on hold show no chat bubble and are read-only in the panel; members on hold can sign in and read but cannot reply. Nothing has been deleted. Choose which ones stay active.',
    sites: 'Sites that stay active ({{chosen}}/{{limit}})',
    members: 'Team members who can reply ({{chosen}}/{{limit}})',
    owner: 'Account owner, always active',
    suspended: 'On hold',
    active: 'Active',
    save: 'Save choice',
    saved: 'Your choice is saved.',
    saveError: 'Could not save your choice.',
    upgrade: 'Or upgrade to bring them all back',
    choose: 'Choose',
    ownerBanner:
      'Some sites or team members are over your plan and on hold. Choose which ones stay active.',
    seatBanner:
      'The team is over its seat limit, so your account is read-only for now: you can read conversations but not reply. The account owner can bring you back.',
    siteHint: 'Over the plan limit: chat bubble hidden, settings read-only.'
  },
  errors: {
    seatSuspended:
      'Your account is read-only because of the plan limit; you cannot reply or make changes.',
    siteSuspended:
      'This site is over the plan limit and on hold; you can read it but not change it.',
    overPlanLimit: 'You chose more than your plan allows.'
  },
  retention: {
    title: 'Conversation retention',
    description:
      'Conversations whose last message is older than this are deleted for good every night, with their messages and attachments.',
    keep: 'Keep conversations for:',
    days_one: '{{count}} day',
    days_other: '{{count}} days',
    years_one: '{{count}} year',
    years_other: '{{count}} years',
    default: 'default',
    fixed: 'On the Free plan conversations are kept for {{period}}.',
    upgrade: 'Upgrade to keep them longer',
    saved: 'Retention saved.'
  },
  visitorErase: {
    button: 'Delete this visitor’s data',
    title: 'Delete this visitor’s data?',
    message:
      'Every conversation this visitor had on this site, with its messages, the files they sent, their visitor record and page activity, is deleted for good. Use it for data-deletion requests under KVKK/GDPR. This cannot be undone.',
    confirm: 'Delete for good',
    done_one: 'The visitor’s data is deleted ({{count}} conversation).',
    done_other: 'The visitor’s data is deleted ({{count}} conversations).'
  },
  visitorBlocks: {
    block: 'Block visitor',
    explain:
      'The visitor cannot start a chat on this site, and their open window closes at once. The block applies to their visitor id and the connection they were last seen from.',
    period: 'Period',
    days_one: '{{count}} day',
    days_other: '{{count}} days',
    reason: 'Reason (optional, only your team sees it)',
    confirm: 'Block',
    blocked: 'Visitor blocked.',
    listTitle: 'Blocked visitors',
    empty: 'No visitors are blocked on this site.',
    noReason: 'No reason given',
    range: '{{from}} – {{to}}',
    unblock: 'Unblock',
    unblocked: 'Block removed.'
  },
  savedReplies: {
    title: 'Saved replies',
    description: 'Save the answers you write often; typing "/" in the reply box lists them.',
    shortcut: 'Shortcut',
    titleLabel: 'Title',
    body: 'Text',
    variables: 'Variables you can use:',
    site: 'Site',
    allSites: 'All sites',
    add: 'Add',
    update: 'Update',
    edit: 'Edit',
    delete: 'Delete',
    saved: 'Saved reply stored.',
    empty: 'No saved replies yet.',
    none: 'No matching saved reply',
    placeholder: 'Type your message… (/ for saved replies)'
  },
  audit: {
    actions: {
      LOGIN_FAILED_LOCKED: 'Account Temporarily Locked',
      PASSWORD_CHANGED: 'Password Changed',
      EMAIL_CHANGE_REQUESTED: 'E-mail Change Requested',
      EMAIL_CHANGED: 'E-mail Address Changed',
      MFA_ENABLED: 'Two-Step Verification On',
      MFA_DISABLED: 'Two-Step Verification Off',
      MFA_RECOVERY_USED: 'Signed In With a Recovery Code',
      SESSIONS_REVOKED: 'Signed Out Everywhere',
      SECURITY_SETTINGS_UPDATED: 'Team Security Setting Changed',
      VISITOR_BLOCKED: 'Visitor Blocked',
      VISITOR_UNBLOCKED: 'Visitor Unblocked',
      VISITOR_DATA_DELETED: 'Visitor Data Deleted',
      RETENTION_PURGE: 'Expired Data Deleted',
      RETENTION_SETTINGS_UPDATED: 'Retention Period Changed',
      ASSISTANT_ENABLED: 'AI Assistant Turned On',
      ASSISTANT_KILL_SWITCH: 'Assistant Stopped Platform-Wide',
      API_KEY_CREATED: 'API Key Created',
      API_KEY_REVOKED: 'API Key Revoked',
      WEBHOOK_CREATED: 'Webhook Added',
      WEBHOOK_UPDATED: 'Webhook Changed',
      WEBHOOK_DELETED: 'Webhook Deleted',
      SITE_SUSPENDED: 'Site Suspended',
      SITE_REACTIVATED: 'Site Reactivated',
      SEAT_SUSPENDED: 'Team Member Put on Hold',
      SEAT_RESTORED: 'Team Member Reactivated',
      TRIAL_STARTED: 'Pro Trial Started',
      TRIAL_ENDED: 'Pro Trial Ended',
      SAVED_REPLY_CREATED: 'Saved Reply Added',
      SAVED_REPLY_UPDATED: 'Saved Reply Changed',
      SAVED_REPLY_DELETED: 'Saved Reply Deleted',
      CONVERSATIONS_MERGED: 'Conversations Merged'
    }
  }
};
