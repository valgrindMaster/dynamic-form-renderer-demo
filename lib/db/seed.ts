import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './index';
import { formsTable, submissionsTable } from './schema';
import { FormDefinitionSchema } from '../forms/meta';
import type { FormDefinition } from '../forms/types';

// Convention: top-level `required: true` synthesizes a default required
// validation. Only include `{ kind: 'required', message }` in the validation
// array when you want a custom message. Don't duplicate it bare.

const contactForm: FormDefinition = {
  title: 'Contact Us',
  description: 'Send us a message — we usually reply within two business days.',
  fields: [
    {
      type: 'text',
      name: 'name',
      label: 'Your name',
      required: true,
      validation: [
        { kind: 'required', message: 'Please tell us your name.' },
        { kind: 'maxLength', value: 100 },
      ],
    },
    {
      type: 'text',
      name: 'email',
      label: 'Email',
      required: true,
      placeholder: 'you@example.com',
      validation: [
        {
          kind: 'pattern',
          regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
          message: 'Enter a valid email address.',
        },
      ],
    },
    {
      type: 'text',
      name: 'subject',
      label: 'Subject',
      placeholder: 'What is this about?',
    },
    {
      type: 'textarea',
      name: 'message',
      label: 'Message',
      required: true,
      rows: 6,
      validation: [
        {
          kind: 'minLength',
          value: 10,
          message: 'At least 10 characters please.',
        },
        { kind: 'maxLength', value: 2000 },
      ],
    },
  ],
};

const jobApplicationForm: FormDefinition = {
  title: 'Job Application',
  description:
    'Apply for an open role. Conditional fields appear based on employment type.',
  fields: [
    {
      type: 'text',
      name: 'fullName',
      label: 'Full name',
      required: true,
    },
    {
      type: 'text',
      name: 'email',
      label: 'Email',
      required: true,
      validation: [
        { kind: 'pattern', regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
      ],
    },
    {
      type: 'text',
      name: 'phone',
      label: 'Phone',
      description: 'Optional — only if you prefer phone follow-up.',
    },
    {
      type: 'select',
      name: 'position',
      label: 'Position',
      placeholder: 'Select a role',
      required: true,
      options: [
        { label: 'Software Engineer', value: 'engineering' },
        { label: 'Product Designer', value: 'design' },
        { label: 'Product Manager', value: 'product' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      type: 'number',
      name: 'yearsExperience',
      label: 'Years of experience',
      required: true,
      validation: [
        { kind: 'min', value: 0 },
        { kind: 'max', value: 50 },
      ],
    },
    {
      type: 'radio',
      name: 'employmentType',
      label: 'Preferred employment type',
      required: true,
      options: [
        { label: 'Full-time', value: 'full-time' },
        { label: 'Part-time', value: 'part-time' },
        { label: 'Contract', value: 'contract' },
      ],
    },
    {
      type: 'number',
      name: 'desiredSalary',
      label: 'Desired annual salary (USD)',
      visibleWhen: {
        any: [
          { field: 'employmentType', equals: 'full-time' },
          { field: 'employmentType', equals: 'contract' },
        ],
      },
      displayHints: {
        thousandsSeparator: true,
        prefix: '$',
        decimals: 0,
      },
    },
    {
      type: 'checkboxGroup',
      name: 'skills',
      label: 'Relevant skills',
      description: 'Select all that apply.',
      options: [
        { label: 'TypeScript', value: 'typescript' },
        { label: 'React', value: 'react' },
        { label: 'Node.js', value: 'node' },
        { label: 'SQL', value: 'sql' },
        { label: 'Python', value: 'python' },
      ],
    },
    {
      type: 'textarea',
      name: 'coverLetter',
      label: 'Cover letter',
      rows: 8,
      validation: [{ kind: 'minLength', value: 50 }],
    },
    {
      type: 'checkbox',
      name: 'agreeToTerms',
      label: 'I agree to the applicant terms and privacy policy.',
      required: true,
      validation: [
        { kind: 'required', message: 'You must agree to continue.' },
      ],
    },
  ],
};

const rsvpForm: FormDefinition = {
  title: 'Annual Retreat RSVP',
  description:
    'Let us know if you can make it. Logistics fields appear if you are attending.',
  fields: [
    {
      type: 'text',
      name: 'guestName',
      label: 'Your name',
      required: true,
    },
    {
      type: 'text',
      name: 'email',
      label: 'Email',
      required: true,
      validation: [
        { kind: 'pattern', regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
      ],
    },
    {
      type: 'radio',
      name: 'attending',
      label: 'Will you attend?',
      required: true,
      options: [
        { label: 'Yes, count me in', value: 'yes' },
        { label: 'No, sorry to miss it', value: 'no' },
      ],
    },
    {
      type: 'number',
      name: 'numberOfGuests',
      label: 'Number of guests (including yourself)',
      defaultValue: 1,
      visibleWhen: { field: 'attending', equals: 'yes' },
      validation: [
        { kind: 'min', value: 1 },
        { kind: 'max', value: 5, message: 'Up to 5 guests per RSVP.' },
      ],
    },
    {
      type: 'date',
      name: 'arrivalDate',
      label: 'Planned arrival date',
      visibleWhen: { field: 'attending', equals: 'yes' },
      validation: [{ kind: 'minDate', value: '2026-05-01' }],
    },
    {
      type: 'checkboxGroup',
      name: 'dietaryRestrictions',
      label: 'Dietary restrictions',
      visibleWhen: { field: 'attending', equals: 'yes' },
      options: [
        { label: 'Vegetarian', value: 'vegetarian' },
        { label: 'Vegan', value: 'vegan' },
        { label: 'Gluten-free', value: 'gluten-free' },
        { label: 'Kosher', value: 'kosher' },
        { label: 'Halal', value: 'halal' },
      ],
    },
    {
      type: 'checkbox',
      name: 'newsletterOptIn',
      label: 'Send me the post-event recap newsletter.',
      defaultValue: true,
    },
  ],
};

const feedbackForm: FormDefinition = {
  title: 'Product Feedback',
  description:
    'Help us improve. Follow-up questions appear based on your answers.',
  fields: [
    {
      type: 'text',
      name: 'email',
      label: 'Email (optional)',
      description: 'Only if you would like a personal follow-up.',
    },
    {
      type: 'radio',
      name: 'satisfaction',
      label: 'How satisfied are you overall?',
      required: true,
      options: [
        { label: '1 — Very dissatisfied', value: '1' },
        { label: '2', value: '2' },
        { label: '3', value: '3' },
        { label: '4', value: '4' },
        { label: '5 — Very satisfied', value: '5' },
      ],
    },
    {
      type: 'checkboxGroup',
      name: 'improvementAreas',
      label: 'Where could we improve?',
      visibleWhen: { field: 'satisfaction', in: ['1', '2', '3'] },
      options: [
        { label: 'Speed / performance', value: 'speed' },
        { label: 'Customer support', value: 'support' },
        { label: 'Pricing', value: 'pricing' },
        { label: 'Missing features', value: 'features' },
        { label: 'Documentation', value: 'docs' },
      ],
    },
    {
      type: 'radio',
      name: 'recommendation',
      label: 'Would you recommend us to a colleague?',
      required: true,
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'Maybe', value: 'maybe' },
        { label: 'No', value: 'no' },
      ],
    },
    {
      type: 'textarea',
      name: 'followUpDetail',
      label: 'What went wrong?',
      description:
        'Visible when satisfaction is low and you would not recommend us.',
      rows: 5,
      visibleWhen: {
        all: [
          { field: 'satisfaction', in: ['1', '2'] },
          { field: 'recommendation', equals: 'no' },
        ],
      },
      validation: [{ kind: 'minLength', value: 20 }],
    },
    {
      type: 'textarea',
      name: 'testimonial',
      label: 'Mind if we quote you?',
      rows: 4,
      visibleWhen: { field: 'recommendation', equals: 'yes' },
    },
  ],
};

const orderForm: FormDefinition = {
  title: 'Place an Order',
  description:
    'Order a widget. Shipping fields appear when you choose delivery.',
  fields: [
    {
      type: 'select',
      name: 'productName',
      label: 'Product',
      required: true,
      placeholder: 'Choose a widget',
      options: [
        { label: 'Widget A — Standard', value: 'widget-a' },
        { label: 'Widget B — Premium', value: 'widget-b' },
        { label: 'Widget C — Deluxe', value: 'widget-c' },
      ],
    },
    {
      type: 'number',
      name: 'quantity',
      label: 'Quantity',
      required: true,
      defaultValue: 1,
      displayHints: { thousandsSeparator: true, decimals: 0 },
      validation: [
        { kind: 'min', value: 1 },
        { kind: 'max', value: 1000 },
      ],
    },
    {
      type: 'radio',
      name: 'fulfillment',
      label: 'How would you like to receive it?',
      required: true,
      options: [
        { label: 'Pick up at warehouse', value: 'pickup' },
        { label: 'Ship to me', value: 'ship' },
      ],
    },
    {
      type: 'textarea',
      name: 'shippingAddress',
      label: 'Shipping address',
      rows: 4,
      visibleWhen: { field: 'fulfillment', equals: 'ship' },
      validation: [{ kind: 'minLength', value: 10 }],
    },
    {
      type: 'checkbox',
      name: 'giftWrap',
      label: 'Add gift wrapping (+$5)',
      defaultValue: false,
    },
    {
      type: 'textarea',
      name: 'giftMessage',
      label: 'Gift message',
      rows: 3,
      visibleWhen: { field: 'giftWrap', equals: true },
      validation: [{ kind: 'maxLength', value: 200 }],
    },
  ],
};

const forms: FormDefinition[] = [
  contactForm,
  jobApplicationForm,
  rsvpForm,
  feedbackForm,
  orderForm,
];

type SubmissionSeed = {
  formTitle: string;
  values: Record<string, unknown>;
  createdAt: Date;
};

// Spreads timestamps relative to "now" so each re-seed produces fresh-looking data.
const daysAgo = (n: number, hour = 12, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const submissions: SubmissionSeed[] = [
  // ── Contact Us ────────────────────────────────────────────────────────────
  {
    formTitle: contactForm.title,
    createdAt: daysAgo(13, 9, 14),
    values: {
      name: 'Edsger Dijkstra',
      email: 'edsger@cs.utexas.edu',
      subject: 'Detailed feedback',
      message:
        'Spent the morning reading through your docs. Overall impressed, but the section on conditional rendering glosses over how predicates compose. Happy to suggest specific edits.',
    },
  },
  {
    formTitle: contactForm.title,
    createdAt: daysAgo(12, 10, 32),
    values: {
      name: 'Barbara Liskov',
      email: 'barbara@mit.edu',
      subject: 'Cancel my subscription',
      message:
        'Could you point me to the cancellation flow? I cannot find it in my account settings.',
    },
  },
  {
    formTitle: contactForm.title,
    createdAt: daysAgo(11, 16, 5),
    values: {
      name: 'Donald Knuth',
      email: 'don@stanford.edu',
      subject: 'Feature request',
      message:
        'Would love to see LaTeX export for forms. Is this on the roadmap?',
    },
  },
  {
    formTitle: contactForm.title,
    createdAt: daysAgo(10, 8, 41),
    values: {
      name: 'Tim Berners-Lee',
      email: 'tim@w3.org',
      subject: 'Partnership inquiry',
      message:
        'Interested in discussing how your form schema could complement open standards work.',
    },
  },
  {
    formTitle: contactForm.title,
    createdAt: daysAgo(9, 14, 22),
    values: {
      name: 'Alan Turing',
      email: 'alan@kingscollege.cam.ac.uk',
      subject: 'Bug report',
      message:
        'Submitting a checkbox group with zero selections throws on save. Repro steps in the attached gist.',
    },
  },
  {
    formTitle: contactForm.title,
    createdAt: daysAgo(8, 11, 9),
    values: {
      name: 'Hedy Lamarr',
      email: 'hedy@example.com',
      message: 'How does the pricing scale for teams over 50 users?',
    },
  },
  {
    formTitle: contactForm.title,
    createdAt: daysAgo(7, 13, 50),
    values: {
      name: 'Margaret Hamilton',
      email: 'margaret@apollo.nasa',
      message: 'Loving the new release. Keep up the great work!',
    },
  },
  {
    formTitle: contactForm.title,
    createdAt: daysAgo(5, 17, 18),
    values: {
      name: 'Linus Torvalds',
      email: 'linus@kernel.org',
      subject: 'Partnership inquiry',
      message: 'Interested in discussing a co-marketing opportunity.',
    },
  },
  {
    formTitle: contactForm.title,
    createdAt: daysAgo(3, 9, 2),
    values: {
      name: 'Grace Hopper',
      email: 'grace@navy.mil',
      message: 'Found a bug in the parser — happy to share a repro.',
    },
  },
  {
    formTitle: contactForm.title,
    createdAt: daysAgo(2, 15, 47),
    values: {
      name: 'Ada Lovelace',
      email: 'ada@analyticalengine.org',
      subject: 'Question about pricing',
      message: 'Could you walk me through the enterprise tier?',
    },
  },

  // ── Job Application ───────────────────────────────────────────────────────
  {
    formTitle: jobApplicationForm.title,
    createdAt: daysAgo(27, 10, 12),
    values: {
      fullName: 'Noah Patel',
      email: 'noah.patel@example.com',
      position: 'design',
      yearsExperience: 7,
      employmentType: 'full-time',
      desiredSalary: 145000,
      skills: ['typescript', 'react'],
      coverLetter:
        'Senior product designer with a track record of shipping design systems at scale. Looking to join a team that takes craft seriously.',
      agreeToTerms: true,
    },
  },
  {
    formTitle: jobApplicationForm.title,
    createdAt: daysAgo(23, 9, 3),
    values: {
      fullName: 'Olivia Brown',
      email: 'olivia.brown@example.com',
      phone: '+1-555-0211',
      position: 'engineering',
      yearsExperience: 12,
      employmentType: 'contract',
      desiredSalary: 250000,
      skills: ['typescript', 'node', 'sql', 'python'],
      coverLetter:
        'Backend specialist looking for a 3-6 month contract. Recently led a database migration project for a fintech.',
      agreeToTerms: true,
    },
  },
  {
    formTitle: jobApplicationForm.title,
    createdAt: daysAgo(20, 14, 29),
    values: {
      fullName: 'Wei Zhang',
      email: 'wei.zhang@example.com',
      position: 'engineering',
      yearsExperience: 5,
      employmentType: 'part-time',
      skills: ['react', 'typescript', 'sql'],
      agreeToTerms: true,
    },
  },
  {
    formTitle: jobApplicationForm.title,
    createdAt: daysAgo(18, 11, 47),
    values: {
      fullName: 'Sofia Mendes',
      email: 'sofia@example.com',
      phone: '+1-555-0166',
      position: 'product',
      yearsExperience: 8,
      employmentType: 'full-time',
      desiredSalary: 195000,
      skills: ['sql', 'python'],
      coverLetter:
        'Product manager with strong analytics background. Excited about your data tooling and would love to contribute to roadmap planning.',
      agreeToTerms: true,
    },
  },
  {
    formTitle: jobApplicationForm.title,
    createdAt: daysAgo(15, 16, 8),
    values: {
      fullName: 'Ben Carter',
      email: 'ben.carter@example.com',
      position: 'design',
      yearsExperience: 3,
      employmentType: 'contract',
      desiredSalary: 90000,
      skills: ['typescript'],
      coverLetter:
        'Junior designer transitioning from agency work. Open to short contract engagements to build my product portfolio.',
      agreeToTerms: true,
    },
  },
  {
    formTitle: jobApplicationForm.title,
    createdAt: daysAgo(12, 10, 51),
    values: {
      fullName: 'Aiko Tanaka',
      email: 'aiko@example.com',
      position: 'engineering',
      yearsExperience: 4,
      employmentType: 'full-time',
      desiredSalary: 135000,
      skills: ['typescript', 'react', 'node'],
      coverLetter:
        'Full-stack engineer focused on developer experience. Built internal tooling at my last two companies.',
      agreeToTerms: true,
    },
  },
  {
    formTitle: jobApplicationForm.title,
    createdAt: daysAgo(10, 13, 19),
    values: {
      fullName: 'Marcus Chen',
      email: 'marcus@example.com',
      position: 'engineering',
      yearsExperience: 2,
      employmentType: 'full-time',
      desiredSalary: 110000,
      skills: ['typescript', 'react'],
      coverLetter:
        'Recent bootcamp graduate with two years at a fintech startup. Eager to grow with a strong team.',
      agreeToTerms: true,
    },
  },
  {
    formTitle: jobApplicationForm.title,
    createdAt: daysAgo(8, 9, 38),
    values: {
      fullName: 'Priya Shah',
      email: 'priya.shah@example.com',
      phone: '+1-555-0188',
      position: 'product',
      yearsExperience: 9,
      employmentType: 'contract',
      desiredSalary: 220000,
      skills: ['sql', 'python'],
      coverLetter:
        'Product leader with a background in data platforms. Open to a 6-month contract to start.',
      agreeToTerms: true,
    },
  },
  {
    formTitle: jobApplicationForm.title,
    createdAt: daysAgo(6, 15, 4),
    values: {
      fullName: 'Jordan Lee',
      email: 'jordan@example.com',
      position: 'design',
      yearsExperience: 4,
      employmentType: 'part-time',
      skills: ['typescript'],
      coverLetter:
        'Designer with engineering chops. Looking for part-time work while finishing a graduate program.',
      agreeToTerms: true,
    },
  },
  {
    formTitle: jobApplicationForm.title,
    createdAt: daysAgo(4, 11, 26),
    values: {
      fullName: 'Sam Rivera',
      email: 'sam.rivera@example.com',
      phone: '+1-555-0142',
      position: 'engineering',
      yearsExperience: 6,
      employmentType: 'full-time',
      desiredSalary: 165000,
      skills: ['typescript', 'react', 'node', 'sql'],
      coverLetter:
        'I have spent the last six years building developer-facing tools and would love to bring that experience here.',
      agreeToTerms: true,
    },
  },

  // ── Annual Retreat RSVP ───────────────────────────────────────────────────
  {
    formTitle: rsvpForm.title,
    createdAt: daysAgo(6, 8, 12),
    values: {
      guestName: 'Pedro Silva',
      email: 'pedro@example.com',
      attending: 'no',
      newsletterOptIn: false,
    },
  },
  {
    formTitle: rsvpForm.title,
    createdAt: daysAgo(5, 14, 2),
    values: {
      guestName: 'Yuki Sato',
      email: 'yuki@example.com',
      attending: 'yes',
      numberOfGuests: 1,
      arrivalDate: '2026-05-12',
      dietaryRestrictions: [],
      newsletterOptIn: true,
    },
  },
  {
    formTitle: rsvpForm.title,
    createdAt: daysAgo(5, 9, 47),
    values: {
      guestName: 'Anna Kowalski',
      email: 'anna.k@example.com',
      attending: 'yes',
      numberOfGuests: 2,
      arrivalDate: '2026-05-14',
      dietaryRestrictions: ['gluten-free', 'halal'],
      newsletterOptIn: true,
    },
  },
  {
    formTitle: rsvpForm.title,
    createdAt: daysAgo(4, 16, 33),
    values: {
      guestName: 'Carlos Reyes',
      email: 'carlos@example.com',
      attending: 'no',
      newsletterOptIn: true,
    },
  },
  {
    formTitle: rsvpForm.title,
    createdAt: daysAgo(4, 11, 19),
    values: {
      guestName: 'Mei Lin',
      email: 'mei.lin@example.com',
      attending: 'yes',
      numberOfGuests: 3,
      arrivalDate: '2026-05-13',
      dietaryRestrictions: ['vegan'],
      newsletterOptIn: true,
    },
  },
  {
    formTitle: rsvpForm.title,
    createdAt: daysAgo(3, 13, 8),
    values: {
      guestName: 'Felix Dubois',
      email: 'felix@example.com',
      attending: 'yes',
      numberOfGuests: 1,
      arrivalDate: '2026-05-16',
      dietaryRestrictions: ['vegetarian'],
      newsletterOptIn: false,
    },
  },
  {
    formTitle: rsvpForm.title,
    createdAt: daysAgo(3, 10, 55),
    values: {
      guestName: 'Hana Bjornsdottir',
      email: 'hana@example.com',
      attending: 'yes',
      numberOfGuests: 4,
      arrivalDate: '2026-05-13',
      dietaryRestrictions: [],
      newsletterOptIn: true,
    },
  },
  {
    formTitle: rsvpForm.title,
    createdAt: daysAgo(2, 17, 21),
    values: {
      guestName: 'Riley Okonkwo',
      email: 'riley@example.com',
      attending: 'yes',
      numberOfGuests: 1,
      arrivalDate: '2026-05-15',
      dietaryRestrictions: ['vegan', 'gluten-free'],
      newsletterOptIn: false,
    },
  },
  {
    formTitle: rsvpForm.title,
    createdAt: daysAgo(2, 8, 4),
    values: {
      guestName: 'Theo Nakamura',
      email: 'theo@example.com',
      attending: 'no',
      newsletterOptIn: true,
    },
  },
  {
    formTitle: rsvpForm.title,
    createdAt: daysAgo(1, 12, 37),
    values: {
      guestName: 'Eleanor Park',
      email: 'eleanor@example.com',
      attending: 'yes',
      numberOfGuests: 2,
      arrivalDate: '2026-05-14',
      dietaryRestrictions: ['vegetarian'],
      newsletterOptIn: true,
    },
  },

  // ── Product Feedback ──────────────────────────────────────────────────────
  {
    formTitle: feedbackForm.title,
    createdAt: daysAgo(55, 14, 11),
    values: {
      email: 'frustrated@example.com',
      satisfaction: '1',
      improvementAreas: ['support', 'docs'],
      recommendation: 'no',
      followUpDetail:
        'Documentation is sparse and support takes 3+ business days to reply. Hard to recommend in its current state.',
    },
  },
  {
    formTitle: feedbackForm.title,
    createdAt: daysAgo(50, 10, 27),
    values: {
      satisfaction: '3',
      improvementAreas: ['features'],
      recommendation: 'maybe',
    },
  },
  {
    formTitle: feedbackForm.title,
    createdAt: daysAgo(45, 9, 8),
    values: {
      satisfaction: '4',
      recommendation: 'yes',
    },
  },
  {
    formTitle: feedbackForm.title,
    createdAt: daysAgo(40, 16, 44),
    values: {
      email: 'mixed@example.com',
      satisfaction: '2',
      improvementAreas: ['speed', 'pricing'],
      recommendation: 'no',
      followUpDetail:
        'The product itself is good but the pricing changes caught us off guard and renewal is going to be a tough conversation internally.',
    },
  },
  {
    formTitle: feedbackForm.title,
    createdAt: daysAgo(35, 11, 16),
    values: {
      satisfaction: '2',
      improvementAreas: ['speed', 'features'],
      recommendation: 'maybe',
    },
  },
  {
    formTitle: feedbackForm.title,
    createdAt: daysAgo(30, 13, 53),
    values: {
      email: 'enthusiast@example.com',
      satisfaction: '5',
      recommendation: 'yes',
      testimonial:
        'Genuinely the best tool in this category. Saved our team weeks of work.',
    },
  },
  {
    formTitle: feedbackForm.title,
    createdAt: daysAgo(25, 8, 19),
    values: {
      satisfaction: '4',
      recommendation: 'yes',
      testimonial: 'Solid product, would recommend with minor caveats.',
    },
  },
  {
    formTitle: feedbackForm.title,
    createdAt: daysAgo(20, 10, 48),
    values: {
      email: 'unhappy@example.com',
      satisfaction: '1',
      improvementAreas: ['support', 'pricing', 'features'],
      recommendation: 'no',
      followUpDetail:
        'Tried to get help for two days and never heard back. Considering a competitor at this point.',
    },
  },
  {
    formTitle: feedbackForm.title,
    createdAt: daysAgo(15, 15, 32),
    values: {
      satisfaction: '3',
      improvementAreas: ['speed', 'docs'],
      recommendation: 'maybe',
    },
  },
  {
    formTitle: feedbackForm.title,
    createdAt: daysAgo(10, 9, 1),
    values: {
      email: 'fan@example.com',
      satisfaction: '5',
      recommendation: 'yes',
      testimonial: 'Best tool I have used for this in years.',
    },
  },

  // ── Place an Order ────────────────────────────────────────────────────────
  {
    formTitle: orderForm.title,
    createdAt: daysAgo(21, 11, 7),
    values: {
      productName: 'widget-a',
      quantity: 15,
      fulfillment: 'pickup',
      giftWrap: false,
    },
  },
  {
    formTitle: orderForm.title,
    createdAt: daysAgo(19, 14, 22),
    values: {
      productName: 'widget-c',
      quantity: 1,
      fulfillment: 'ship',
      shippingAddress: '350 Fifth Avenue, New York, NY 10118',
      giftWrap: true,
      giftMessage: 'Congrats on the promotion!',
    },
  },
  {
    formTitle: orderForm.title,
    createdAt: daysAgo(17, 9, 49),
    values: {
      productName: 'widget-b',
      quantity: 10,
      fulfillment: 'pickup',
      giftWrap: true,
      giftMessage:
        'Team appreciation gift — thanks for everything this quarter.',
    },
  },
  {
    formTitle: orderForm.title,
    createdAt: daysAgo(15, 16, 11),
    values: {
      productName: 'widget-a',
      quantity: 50,
      fulfillment: 'ship',
      shippingAddress: '200 Larkin Street, San Francisco, CA 94102',
      giftWrap: false,
    },
  },
  {
    formTitle: orderForm.title,
    createdAt: daysAgo(13, 10, 35),
    values: {
      productName: 'widget-c',
      quantity: 2,
      fulfillment: 'ship',
      shippingAddress: '85 Broad Street, New York, NY 10004',
      giftWrap: true,
      giftMessage: 'Happy holidays from the whole crew.',
    },
  },
  {
    formTitle: orderForm.title,
    createdAt: daysAgo(11, 13, 4),
    values: {
      productName: 'widget-b',
      quantity: 5,
      fulfillment: 'ship',
      shippingAddress: '100 Universal City Plaza, Universal City, CA 91608',
      giftWrap: false,
    },
  },
  {
    formTitle: orderForm.title,
    createdAt: daysAgo(9, 8, 56),
    values: {
      productName: 'widget-a',
      quantity: 100,
      fulfillment: 'pickup',
      giftWrap: false,
    },
  },
  {
    formTitle: orderForm.title,
    createdAt: daysAgo(6, 17, 28),
    values: {
      productName: 'widget-c',
      quantity: 25,
      fulfillment: 'ship',
      shippingAddress: '1 Infinite Loop, Cupertino, CA 95014',
      giftWrap: false,
    },
  },
  {
    formTitle: orderForm.title,
    createdAt: daysAgo(4, 12, 13),
    values: {
      productName: 'widget-b',
      quantity: 1,
      fulfillment: 'ship',
      shippingAddress: '742 Evergreen Terrace, Springfield, IL 62704',
      giftWrap: true,
      giftMessage: 'Happy birthday from the whole team!',
    },
  },
  {
    formTitle: orderForm.title,
    createdAt: daysAgo(2, 10, 41),
    values: {
      productName: 'widget-a',
      quantity: 3,
      fulfillment: 'pickup',
      giftWrap: false,
    },
  },
];

const baseDate = new Date();
submissions.map((s) => ({
  ...s,
  // Spread submissions across the last ~60 days, randomly per submission
  createdAt: new Date(
    baseDate.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000,
  ),
  updatedAt: new Date(
    baseDate.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000,
  ),
}));

async function main() {
  forms.forEach((form, i) => {
    const result = FormDefinitionSchema.safeParse(form);
    if (!result.success) {
      throw new Error(
        `Form at index ${i} (${form.title}) failed validation:\n${z.prettifyError(result.error)}`,
      );
    }
  });

  const knownTitles = new Set(forms.map((f) => f.title));
  for (const s of submissions) {
    if (!knownTitles.has(s.formTitle)) {
      throw new Error(`Submission references unknown form: "${s.formTitle}"`);
    }
  }

  await db.execute(
    sql`TRUNCATE TABLE ${submissionsTable}, ${formsTable} RESTART IDENTITY CASCADE`,
  );

  const insertedForms = await db
    .insert(formsTable)
    .values(forms.map((schema) => ({ schema })))
    .returning({ id: formsTable.id });

  const formIdByTitle = new Map<string, number>();
  forms.forEach((form, i) =>
    formIdByTitle.set(form.title, insertedForms[i].id),
  );

  await db.insert(submissionsTable).values(
    submissions.map((s) => ({
      formId: formIdByTitle.get(s.formTitle)!,
      values: s.values,
      createdAt: s.createdAt,
      updatedAt: s.createdAt,
    })),
  );

  console.log(
    `Seeded ${insertedForms.length} forms and ${submissions.length} submissions.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
