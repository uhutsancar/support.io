import { badRequest } from '../http/errors';

type Check = (value: unknown, path: string) => unknown;

const plainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const owns = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const boolean: Check = (value, path) => {
  if (typeof value !== 'boolean') throw badRequest(`${path} must be a boolean`);
  return value;
};

const integer =
  (min: number, max: number): Check =>
  (value, path) => {
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
      throw badRequest(`${path} must be an integer between ${min} and ${max}`);
    }
    return Number(value);
  };

const hasControlCharacter = (value: string, allowWhitespace = true): boolean =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 && !(allowWhitespace && (code === 9 || code === 10 || code === 13));
  });

const string =
  (max: number): Check =>
  (value, path) => {
    if (typeof value !== 'string' || value.length > max || hasControlCharacter(value)) {
      throw badRequest(`${path} must be a string of at most ${max} characters`);
    }
    return value;
  };

const enumeration =
  (values: readonly string[]): Check =>
  (value, path) => {
    if (typeof value !== 'string' || !values.includes(value)) {
      throw badRequest(`${path} must be one of: ${values.join(', ')}`);
    }
    return value;
  };

const color: Check = (value, path) => {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) {
    throw badRequest(`${path} must be a hexadecimal color`);
  }
  return value.toUpperCase();
};

const shadowColor: Check = (value, path) => {
  if (
    typeof value !== 'string' ||
    !(
      /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value) ||
      /^rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(value)
    )
  ) {
    throw badRequest(`${path} must be a safe color`);
  }
  return value;
};

const paths: Check = (value, path) => {
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    value.some(
      (item) =>
        typeof item !== 'string' ||
        item.length > 200 ||
        !item.startsWith('/') ||
        item.startsWith('//') ||
        /[\\?#]/.test(item) ||
        hasControlCharacter(item, false)
    )
  ) {
    throw badRequest(`${path} must contain at most 50 bounded paths`);
  }
  return [...new Set(value)];
};

const SECTION_SCHEMAS: Record<string, Record<string, Check>> = {
  colors: {
    primary: color,
    header: color,
    background: color,
    text: color,
    textSecondary: color,
    border: color,
    visitorMessageBg: color,
    agentMessageBg: color
  },
  branding: {
    logoWidth: integer(16, 200),
    logoHeight: integer(16, 200),
    brandName: string(100),
    showBrandName: boolean
  },
  button: {
    position: enumeration(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
    size: enumeration(['small', 'medium', 'large']),
    icon: enumeration([
      'message-circle',
      'message-square',
      'help-circle',
      'life-buoy',
      'headphones',
      'sparkles'
    ]),
    showLabel: boolean,
    labelText: string(30),
    borderRadius: integer(0, 50),
    shadow: boolean,
    shadowColor
  },
  window: {
    width: integer(280, 600),
    height: integer(360, 900),
    borderRadius: integer(0, 40),
    headerHeight: integer(40, 120),
    showHeader: boolean,
    showCloseButton: boolean
  },
  messages: {
    welcomeMessage: string(500),
    placeholderText: string(120),
    showTimestamps: boolean,
    showAvatars: boolean,
    messageBubbleRadius: integer(0, 32)
  },
  behavior: {
    autoOpen: boolean,
    autoOpenDelay: integer(0, 120_000),
    showOnPages: paths,
    hideOnPages: paths,
    showUnreadBadge: boolean,
    enableSound: boolean,
    enableNotifications: boolean,
    titleAlert: boolean,
    hideOnMobile: boolean,
    language: enumeration(['auto', 'tr', 'en'])
  },
  typography: {
    fontFamily: enumeration([
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      'Arial, sans-serif',
      'Georgia, serif',
      'Verdana, sans-serif'
    ]),
    fontSize: enumeration(['small', 'medium', 'large']),
    fontWeight: enumeration(['normal', '500', '600', 'bold'])
  },
  advanced: {
    customCSS(value, path) {
      if (value !== null && value !== '') {
        throw badRequest(`${path} is disabled because arbitrary CSS is not a safe widget boundary`);
      }
      return null;
    },
    zIndex: integer(1_000, 2_147_483_000),
    animationSpeed: enumeration(['slow', 'normal', 'fast'])
  }
};

export function widgetConfigUpdates(body: unknown): Record<string, unknown> {
  if (!plainObject(body)) throw badRequest('Widget configuration must be an object');
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 32 * 1024) {
    throw badRequest('Widget configuration is too large');
  }
  const allowedSections = new Set([...Object.keys(SECTION_SCHEMAS), 'isActive']);
  const unknownSections = Object.keys(body).filter((key) => !allowedSections.has(key));
  if (unknownSections.length) throw badRequest(`Unsupported field: ${unknownSections.join(', ')}`);

  const out: Record<string, unknown> = {};
  for (const [section, value] of Object.entries(body)) {
    if (section === 'isActive') {
      out.isActive = boolean(value, 'isActive');
      continue;
    }
    if (!plainObject(value)) throw badRequest(`${section} must be an object`);
    const schema = SECTION_SCHEMAS[section];
    const unknown = Object.keys(value).filter((key) => !owns(schema, key));
    if (unknown.length) throw badRequest(`Unsupported field: ${section}.${unknown.join(', ')}`);
    out[section] = Object.fromEntries(
      Object.entries(value).map(([key, field]) => [key, schema[key]!(field, `${section}.${key}`)])
    );
  }
  if (!Object.keys(out).length) throw badRequest('No valid updates supplied');
  return out;
}

/** Strict validation for the older site.widgetSettings compatibility fields. */
export function siteWidgetSettings(value: unknown): Record<string, unknown> {
  if (!plainObject(value)) throw badRequest('widgetSettings must be an object');
  const schema: Record<string, Check> = {
    position: SECTION_SCHEMAS.button.position,
    primaryColor: color,
    welcomeMessage: string(500),
    placeholderText: string(120),
    showOnPages: paths,
    autoOpen: boolean,
    autoOpenDelay: integer(0, 120_000)
  };
  const unknown = Object.keys(value).filter((key) => !owns(schema, key));
  if (unknown.length) throw badRequest(`Unsupported field: widgetSettings.${unknown.join(', ')}`);
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [key, schema[key]!(field, `widgetSettings.${key}`)])
  );
}
