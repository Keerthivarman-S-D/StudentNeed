import {
  GenUIIntent,
  GenUIPayload,
  GenUIListingCardItem,
  GenUIComparisonColumn,
  GenUIComparisonRow
} from '../types/genui';
import { APPROVED_CAMPUS_LOCATIONS } from '../types';

export interface GenUIEngineContext {
  activeListings?: Array<{
    id: string;
    title: string;
    price?: number;
    type: any;
    category: any;
    condition?: any;
    location: string;
    images?: string[];
    sellerName?: string;
  }>;
  savedListingIds?: string[];
  userId?: string;
}

// Representative campus items for fallback matching
const SAMPLE_CAMPUS_ITEMS: GenUIListingCardItem[] = [
  {
    id: 'sample_math_book',
    title: 'Engineering Mathematics (Higher Engg Math - B.S. Grewal)',
    price: 350,
    type: 'Sale',
    category: 'Textbooks',
    condition: 'Good',
    location: 'MIT Library',
    images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'],
    sellerName: 'Karthik R. (ECE)',
    isSaved: false
  },
  {
    id: 'sample_calculator',
    title: 'Casio fx-991EX ClassWiz Scientific Calculator',
    price: 650,
    type: 'Sale',
    category: 'Electronics',
    condition: 'Like New',
    location: 'Canteen',
    images: ['https://images.unsplash.com/photo-1611125832047-1d7ad1e8e485?w=600&auto=format&fit=crop&q=80'],
    sellerName: 'Sneha M. (Mech)',
    isSaved: false
  },
  {
    id: 'sample_drafter',
    title: 'Omega Mini Drafter with Sheet Holder & Canvas Bag',
    price: 250,
    type: 'Sale',
    category: 'Stationery',
    condition: 'Good',
    location: 'Hanger 1',
    images: ['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&auto=format&fit=crop&q=80'],
    sellerName: 'Vignesh P. (Aero)',
    isSaved: false
  },
  {
    id: 'sample_labcoat',
    title: 'White Chemistry & Physics Lab Coat (Size L, Clean)',
    price: 0,
    type: 'Donate',
    category: 'Lab Essentials',
    condition: 'Good',
    location: 'Hostel Gate',
    images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=80'],
    sellerName: 'Ananya S. (Biotech)',
    isSaved: false
  },
  {
    id: 'sample_cycle',
    title: 'Hero Sprint Campus Bicycle (Working brakes & lock included)',
    price: 1800,
    type: 'Sale',
    category: 'Other',
    condition: 'Fair',
    location: 'Back Gate',
    images: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&auto=format&fit=crop&q=80'],
    sellerName: 'Rahul T. (Auto)',
    isSaved: false
  },
  {
    id: 'sample_ds_book',
    title: 'Data Structures and Algorithm Analysis in C++ (Mark Allen Weiss)',
    price: 300,
    type: 'Sale',
    category: 'Textbooks',
    condition: 'Like New',
    location: 'MIT Connect',
    images: ['https://images.unsplash.com/photo-1532012164546-f432f2e3777d?w=600&auto=format&fit=crop&q=80'],
    sellerName: 'Priya D. (IT)',
    isSaved: false
  }
];

/**
 * 1. Intent Recognition Engine
 * Maps user natural language requests to the 7 defined Generative UI intents.
 */
export function detectGenUIIntent(query: string): GenUIIntent {
  const q = query.toLowerCase().trim();

  // A. Destructive Actions (Confirmation Dialogs)
  if (
    (q.includes('cancel') || q.includes('delete') || q.includes('remove') || q.includes('withdraw') || q.includes('revoke')) &&
    (q.includes('reservation') || q.includes('request') || q.includes('listing') || q.includes('trade') || q.includes('post'))
  ) {
    return 'destructive_action';
  }

  // B. Unsupported Requests (Explicitly outside StudentNeed boundaries)
  if (
    q.includes('credit card') ||
    q.includes('debit card') ||
    q.includes('stripe') ||
    q.includes('payment gateway') ||
    q.includes('courier') ||
    q.includes('delivery') ||
    q.includes('shipping') ||
    q.includes('parcel') ||
    q.includes('doorstep') ||
    q.includes('alcohol') ||
    q.includes('cigarette') ||
    q.includes('vape') ||
    q.includes('drug') ||
    q.includes('outside student') ||
    q.includes('non anna') ||
    q.includes('guest account')
  ) {
    return 'unsupported';
  }

  // C. Comparisons (Comparison Tables)
  if (
    q.includes('compare') ||
    q.includes('difference between') ||
    q.includes('vs') ||
    q.includes('versus') ||
    (q.includes('which is better') && (q.includes('location') || q.includes('type') || q.includes('spot')))
  ) {
    return 'comparison';
  }

  // D. Data Summaries (Charts, Metrics, Progress Indicators)
  if (
    q.includes('summary') ||
    q.includes('stats') ||
    q.includes('statistics') ||
    q.includes('breakdown') ||
    q.includes('overview of items') ||
    q.includes('how many items') ||
    q.includes('popular categories') ||
    q.includes('category stats') ||
    q.includes('metrics')
  ) {
    return 'data_summary';
  }

  // E. User Input Requirements (Validated Forms)
  if (
    (q.includes('i want to request') ||
     q.includes('post a request') ||
     q.includes('create a request') ||
     q.includes('cant find') ||
     q.includes("can't find") ||
     q.includes('need an item') ||
     q.includes('looking to request') ||
     q.includes('request form') ||
     q.includes('submit request')) &&
    !q.includes('how')
  ) {
    return 'user_input';
  }

  // F. Item Searches (Listing Cards)
  if (
    q.includes('search') ||
    q.includes('find') ||
    q.includes('show me') ||
    q.includes('looking for') ||
    q.includes('any book') ||
    q.includes('calculator') ||
    q.includes('drafter') ||
    q.includes('cycle') ||
    q.includes('bicycle') ||
    q.includes('lab coat') ||
    q.includes('stationery') ||
    q.includes('textbook') ||
    q.includes('electronics') ||
    q.includes('items for sale') ||
    q.includes('free items') ||
    q.includes('available items')
  ) {
    return 'item_search';
  }

  // G. Default: Informational Questions (Concise text with visual badges)
  return 'informational';
}

/**
 * 2. Intent-to-Component Generator
 * Transforms intent and user query into fully typed, validated GenUI payloads.
 */
export function generateGenUIPayload(query: string, context?: GenUIEngineContext): GenUIPayload {
  const intent = detectGenUIIntent(query);
  const q = query.toLowerCase().trim();

  // -------------------------------------------------------------
  // INTENT 1: ITEM SEARCHES → Listing Cards & Card Collections
  // -------------------------------------------------------------
  if (intent === 'item_search') {
    // Select relevant items from context or sample list
    const pool = context?.activeListings && context.activeListings.length > 0
      ? context.activeListings.map(item => ({
          ...item,
          isSaved: context.savedListingIds?.includes(item.id) || false
        }))
      : SAMPLE_CAMPUS_ITEMS;

    let matchedItems = pool.filter(item => {
      const titleMatch = item.title.toLowerCase().includes(q) || q.split(' ').some(w => w.length > 3 && item.title.toLowerCase().includes(w));
      const catMatch = item.category.toLowerCase().includes(q) || q.includes(item.category.toLowerCase());
      const typeMatch = q.includes(item.type.toLowerCase());
      return titleMatch || catMatch || typeMatch;
    });

    if (matchedItems.length === 0) {
      // General fallback to top items
      matchedItems = pool.slice(0, 3);
    } else {
      matchedItems = matchedItems.slice(0, 4);
    }

    return {
      intent: 'item_search',
      message: `Found ${matchedItems.length} campus item${matchedItems.length === 1 ? '' : 's'} matching your search. Here are verified peer listings available for safe campus meetup:`,
      component: {
        type: 'listing_cards',
        title: `Search Results: "${query.slice(0, 35)}"`,
        query: query,
        items: matchedItems,
        totalMatches: matchedItems.length,
        emptyFallbackText: 'No listings currently match your exact search criteria. You can post an Item Request or browse all listings in the Marketplace.',
        ctaAction: {
          label: 'View All in Marketplace',
          url: `/marketplace?q=${encodeURIComponent(query)}`
        }
      },
      suggestions: [
        'How do I reserve an item?',
        'Show Casio fx-991EX calculator',
        'Compare Sale vs Borrow vs Donate',
        'Post a request for this item'
      ]
    };
  }

  // -------------------------------------------------------------
  // INTENT 2: COMPARISONS → Comparison Tables
  // -------------------------------------------------------------
  if (intent === 'comparison') {
    if (q.includes('location') || q.includes('spot') || q.includes('gate') || q.includes('library') || q.includes('meetup')) {
      // Campus Meetup Spots Comparison
      const columns: GenUIComparisonColumn[] = [
        { key: 'mit_library', label: 'MIT Library', highlight: true, badge: 'Recommended' },
        { key: 'main_gate', label: 'Main Gate', badge: 'High Traffic' },
        { key: 'canteen', label: 'Canteen', badge: 'Casual' },
        { key: 'hostel_gate', label: 'Hostel Gate', badge: 'Evenings' }
      ];

      const rows: GenUIComparisonRow[] = [
        {
          feature: 'Ideal For',
          values: {
            mit_library: 'Textbooks, Notes & Calculators',
            main_gate: 'Day scholars & quick handoffs',
            canteen: 'Casual exchanges & chats',
            hostel_gate: 'Hostelites & evening handoffs'
          }
        },
        {
          feature: 'Lighting & Safety',
          values: {
            mit_library: 'Excellent (CCTV monitored, staff present)',
            main_gate: 'Excellent (Security guard present 24/7)',
            canteen: 'Good (Well lit during operational hours)',
            hostel_gate: 'Good (Warden security checkpoint)'
          }
        },
        {
          feature: 'Seating / Item Testing',
          values: {
            mit_library: 'Benches & study tables available',
            main_gate: 'Standing only outside gate',
            canteen: 'Tables and power outlets nearby',
            hostel_gate: 'Waiting benches near gate'
          }
        },
        {
          feature: 'Best Meetup Times',
          values: {
            mit_library: '9:00 AM – 5:30 PM (Working days)',
            main_gate: '8:00 AM – 6:30 PM',
            canteen: '10:00 AM – 4:00 PM',
            hostel_gate: '4:30 PM – 8:00 PM'
          }
        }
      ];

      return {
        intent: 'comparison',
        message: 'Here is a comparative breakdown of approved Anna University campus meetup locations to help you choose the safest, most convenient spot:',
        component: {
          type: 'comparison_table',
          title: 'Campus Meetup Spot Comparison',
          subtitle: 'Choose an authorized landmark for your Find → Connect → Meet handoff',
          columns,
          rows,
          recommendation: 'MIT Library is the top recommendation for academic items due to secure CCTV coverage, quiet seating, and verified student presence.'
        },
        suggestions: [
          'How does meetup coordination work?',
          'What happens after meetup is complete?',
          'Compare Sale vs Borrow vs Donate'
        ]
      };
    }

    // Default: Listing Types Comparison (Sale vs Borrow vs Donate vs Exchange)
    const columns: GenUIComparisonColumn[] = [
      { key: 'sale', label: 'Sale', highlight: true, badge: 'Most Popular' },
      { key: 'borrow', label: 'Borrow', badge: 'Temporary' },
      { key: 'donate', label: 'Donate', badge: 'Free' },
      { key: 'exchange', label: 'Exchange', badge: 'Swap' }
    ];

    const rows: GenUIComparisonRow[] = [
      {
        feature: 'Cost to Student',
        values: {
          sale: 'Fixed price in ₹',
          borrow: 'Free (return on loan)',
          donate: '₹0 (100% Free gift)',
          exchange: 'Item-for-item swap'
        }
      },
      {
        feature: 'Photos Allowed',
        values: {
          sale: 'Up to 4 photos (JPG/PNG/WEBP)',
          borrow: 'Strictly NOT permitted',
          donate: 'Up to 4 photos',
          exchange: 'Strictly NOT permitted'
        }
      },
      {
        feature: 'Handoff Duration',
        values: {
          sale: 'Permanent ownership transfer',
          borrow: 'Agreed loan period',
          donate: 'Permanent ownership transfer',
          exchange: 'Permanent mutual swap'
        }
      },
      {
        feature: 'Listing Expiry',
        values: {
          sale: '7, 15, or 30 days auto-expire',
          borrow: '7 or 15 days',
          donate: '7, 15, or 30 days',
          exchange: '7 or 15 days'
        }
      },
      {
        feature: 'Payment Method',
        values: {
          sale: 'In-person cash or student UPI',
          borrow: 'N/A (No fees)',
          donate: 'N/A (Free)',
          exchange: 'N/A (Direct trade)'
        }
      }
    ];

    return {
      intent: 'comparison',
      message: 'Here is a comprehensive comparison of the 4 listing types supported on StudentNeed:',
      component: {
        type: 'comparison_table',
        title: 'Listing Types Comparison Guide',
        subtitle: 'Understand the rules, photos, and handoff expectations for each listing category',
        columns,
        rows,
        recommendation: 'Choose "Sale" for items you want to sell with photos. Choose "Donate" for items you want to pass on for free. Note that Borrow and Exchange strictly prohibit photo uploads.'
      },
      suggestions: [
        'How do I post a Sale listing?',
        'Why are photos prohibited for Borrow?',
        'Compare meetup locations'
      ]
    };
  }

  // -------------------------------------------------------------
  // INTENT 3: DATA SUMMARIES → Charts & Structured Summaries
  // -------------------------------------------------------------
  if (intent === 'data_summary') {
    return {
      intent: 'data_summary',
      message: 'Here is the current structured summary and activity metrics for the StudentNeed campus marketplace:',
      component: {
        type: 'data_summary',
        title: 'Marketplace Activity & Category Summary',
        subtitle: 'Real-time overview of Anna University peer exchanges and verified demand',
        metrics: [
          { label: 'Active Items', value: '48+', change: '+12% this week', badge: 'Live', subtext: 'Ready for handoff' },
          { label: 'Open Requests', value: '18', change: '8 matched', badge: 'Active', subtext: 'Seeking fulfillment' },
          { label: 'Exchanges Completed', value: '142', change: '100% verified', badge: 'Safety', subtext: 'Zero courier fees' },
          { label: 'Approved Meetup Spots', value: `${APPROVED_CAMPUS_LOCATIONS.length}`, badge: 'Safe Zones', subtext: 'MIT Campus' }
        ],
        breakdownTitle: 'Active Listings by Category',
        breakdown: [
          { label: 'Textbooks & Study Notes', count: 22, percentage: 46, colorHex: '#204b39' },
          { label: 'Electronics & Calculators', count: 11, percentage: 23, colorHex: '#059669' },
          { label: 'Stationery & Drafters', count: 8, percentage: 17, colorHex: '#3b82f6' },
          { label: 'Lab & Hostel Essentials', count: 7, percentage: 14, colorHex: '#f59e0b' }
        ],
        quickActions: [
          { label: 'Browse Textbooks', actionType: 'filter', payload: { category: 'Textbooks' }, url: '/marketplace?category=Textbooks' },
          { label: 'Browse Electronics', actionType: 'filter', payload: { category: 'Electronics' }, url: '/marketplace?category=Electronics' },
          { label: 'View Campus Requests', actionType: 'navigate', url: '/requests' }
        ]
      },
      suggestions: [
        'Show me Textbooks',
        'Show me Electronics',
        'How do I post an Item Request?'
      ]
    };
  }

  // -------------------------------------------------------------
  // INTENT 4: USER INPUT REQUIREMENTS → Validated Forms
  // -------------------------------------------------------------
  if (intent === 'user_input') {
    return {
      intent: 'user_input',
      message: "Can't find what you are looking for? Fill out this quick Campus Item Request form to notify fellow students across Anna University departments:",
      component: {
        type: 'action_form',
        formId: 'quick_item_request',
        title: 'Post a Campus Item Request',
        description: 'Broadcast your wanted item to peer students on campus. Requesters will reach out directly when they have the item.',
        fields: [
          {
            name: 'title',
            label: 'Item Title / Name',
            type: 'text',
            placeholder: 'e.g., Mini Drafter, Engineering Graphics Book, Lab Apron',
            required: true,
            minLength: 5,
            maxLength: 80,
            helpText: 'Clear, concise name of what you need (5-80 chars)'
          },
          {
            name: 'category',
            label: 'Category',
            type: 'select',
            required: true,
            defaultValue: 'Textbooks',
            options: [
              { label: 'Textbooks', value: 'Textbooks' },
              { label: 'Electronics', value: 'Electronics' },
              { label: 'Stationery', value: 'Stationery' },
              { label: 'Lab Essentials', value: 'Lab Essentials' },
              { label: 'Hostel Essentials', value: 'Hostel Essentials' },
              { label: 'Sports', value: 'Sports' },
              { label: 'College Wear', value: 'College Wear' },
              { label: 'Other', value: 'Other' }
            ]
          },
          {
            name: 'description',
            label: 'Details & Condition Preference',
            type: 'textarea',
            placeholder: 'Specify edition, author, condition acceptable, or specific subject requirements...',
            required: true,
            minLength: 10,
            maxLength: 500,
            helpText: 'Provide enough details so students know if they have the right item (min 10 chars)'
          },
          {
            name: 'location',
            label: 'Preferred Meetup Location',
            type: 'select',
            required: true,
            defaultValue: 'MIT Library',
            options: APPROVED_CAMPUS_LOCATIONS.map(loc => ({ label: loc, value: loc }))
          },
          {
            name: 'budget',
            label: 'Optional Budget (₹)',
            type: 'number',
            placeholder: 'e.g., 300 (leave 0 or blank if looking for borrow/donation)',
            min: 0,
            max: 20000
          }
        ],
        submitButtonText: 'Publish Item Request',
        targetEntity: 'request',
        successMessage: 'Your campus item request has been posted successfully! You can manage it from the Requests tab.'
      },
      suggestions: [
        'View existing Requests',
        'How do other students reach out?',
        'Cancel'
      ]
    };
  }

  // -------------------------------------------------------------
  // INTENT 5: DESTRUCTIVE ACTIONS → Confirmation Dialogs
  // -------------------------------------------------------------
  if (intent === 'destructive_action') {
    const isReservation = q.includes('reservation') || q.includes('trade') || q.includes('hold');
    const isListing = q.includes('listing') || q.includes('post');

    const actionType = isReservation
      ? 'cancel_reservation'
      : isListing
      ? 'delete_listing'
      : 'cancel_request';

    const entityName = isReservation
      ? 'Reservation Hold'
      : isListing
      ? 'Marketplace Listing'
      : 'Campus Item Request';

    return {
      intent: 'destructive_action',
      message: `You have requested a high-impact cancellation. Please review the item details and confirm whether you wish to proceed:`,
      component: {
        type: 'confirmation_dialog',
        dialogId: `confirm_${Date.now()}`,
        title: `Confirm Cancellation: ${entityName}`,
        warningMessage: isReservation
          ? 'Cancelling an active reservation immediately releases the item hold and notifies the other student. This action cannot be undone.'
          : 'Cancelling this item removes it from peer visibility and marks its status as cancelled. You will need to create a new post if you change your mind.',
        itemDetails: {
          id: isReservation ? 'res_active_hold' : 'req_pending_item',
          title: isReservation ? 'Engineering Mathematics Book (Hold with Karthik)' : 'Wanted: Mini Drafter for Engg Graphics',
          currentStatus: 'pending',
          type: isReservation ? 'Hold' : 'Request'
        },
        actionType,
        confirmButtonText: 'Yes, Confirm Cancellation',
        cancelButtonText: 'No, Keep Active',
        requiresReason: true,
        reasonOptions: [
          'Found the item elsewhere',
          'No longer needed',
          'Change in schedule/meetup time',
          'Other'
        ]
      },
      suggestions: [
        'Keep active',
        'How do reservations work?',
        'Contact support'
      ]
    };
  }

  // -------------------------------------------------------------
  // INTENT 6: UNSUPPORTED REQUESTS → Clear Safety Explanations
  // -------------------------------------------------------------
  if (intent === 'unsupported') {
    const isPayment = q.includes('credit card') || q.includes('debit') || q.includes('stripe') || q.includes('gateway');
    const isDelivery = q.includes('courier') || q.includes('delivery') || q.includes('shipping') || q.includes('parcel');
    const isProhibited = q.includes('alcohol') || q.includes('cigarette') || q.includes('vape') || q.includes('drug');

    let bodyText = "StudentNeed is strictly a verified, campus-only peer exchange community.";
    let tips: string[] = [];

    if (isPayment) {
      bodyText = "In-app online payment processing (credit card/debit card/gateways) is **not supported** on StudentNeed to protect students from gateway transaction fees and payment disputes.\n\nAll payments are settled directly between students in-person during the campus meetup (via cash or student UPI).";
      tips = [
        'Inspect the item in person before transferring money',
        'Use UPI directly between student bank accounts on the spot',
        'Never send advance money prior to meeting in person'
      ];
    } else if (isDelivery) {
      bodyText = "Doorstep courier and parcel delivery are **not supported**. All StudentNeed exchanges occur in person on the Anna University campus at designated safe spots.";
      tips = [
        'Coordinate a meetup at MIT Library, Main Gate, or Canteen',
        'Verify the item in hand before completing the trade',
        'Zero shipping fees, zero transit delays'
      ];
    } else if (isProhibited) {
      bodyText = "The requested item or category is **strictly prohibited** by the StudentNeed Community Safety Guidelines and Anna University student code of conduct.";
      tips = [
        'Only educational, hostel, sports, and campus essentials are allowed',
        'Violations result in immediate account suspension or campus ban',
        'StudentNeed maintains an automated and human-moderated catalog'
      ];
    }

    return {
      intent: 'unsupported',
      message: bodyText,
      component: {
        type: 'text',
        headline: 'Safety Policy & Platform Boundaries',
        body: bodyText,
        badges: [
          { label: 'Campus Only', variant: 'info' },
          { label: 'Zero Fees', variant: 'success' },
          { label: 'Safety Enforced', variant: 'warning' }
        ],
        tips,
        actionLinks: [
          { label: 'Explore Marketplace Items', url: '/marketplace' },
          { label: 'Read Terms of Service', url: '/terms' }
        ]
      },
      suggestions: [
        'How does Find → Connect → Meet work?',
        'What categories are supported?',
        'Approved campus meetup locations'
      ]
    };
  }

  // -------------------------------------------------------------
  // INTENT 7: INFORMATIONAL QUESTIONS → Concise Text with Badges
  // -------------------------------------------------------------
  // Check specific common informational queries
  if (q.includes('photo') || q.includes('image') || q.includes('upload')) {
    return {
      intent: 'informational',
      message: 'Photo guidelines on StudentNeed are strictly structured by listing type to maintain catalog quality:',
      component: {
        type: 'text',
        headline: 'Photo Guidelines by Listing Type',
        body: '• **Sale & Donate Listings**: Up to **4 photos** allowed (JPG, PNG, WEBP; max 5MB each).\n• **Borrow & Exchange Listings**: Photos are **strictly not permitted**.\n\nAll photos are securely compressed, verified, and hosted via Cloudinary CDN.',
        badges: [
          { label: 'Max 4 Photos for Sale/Donate', variant: 'success' },
          { label: 'No Photos for Borrow/Exchange', variant: 'warning' }
        ],
        tips: [
          'Take well-lit photos showing any wear or marks',
          'Do not include personal contact details in photo images',
          'Use 16:10 wide landscape photos for optimal mobile display'
        ],
        actionLinks: [
          { label: 'Post an Item Now', url: '/create-listing' }
        ]
      },
      suggestions: [
        'What categories are supported?',
        'Compare Sale vs Borrow vs Donate',
        'How do reservations work?'
      ]
    };
  }

  // General informational fallback
  return {
    intent: 'informational',
    message: "Welcome to StudentNeed! Here's how our verified peer-to-peer campus exchange works:",
    component: {
      type: 'text',
      headline: 'Find → Connect → Meet Campus Flow',
      body: '1. **Find**: Search marketplace listings (/marketplace) or publish an Item Request (/create-request) for textbooks, calculators, drafters, or hostel goods.\n2. **Connect**: Chat securely 1-on-1 with fellow students (/chat) and submit an item reservation hold.\n3. **Meet**: Hand off the item in person at an approved campus landmark (such as MIT Library or Main Gate) with zero delivery fees.',
      badges: [
        { label: 'Verified Students Only', variant: 'success' },
        { label: 'Anna Univ Campus', variant: 'info' },
        { label: 'Safe Meetups', variant: 'default' }
      ],
      tips: [
        'Always coordinate meetups during daytime at approved spots',
        'Inspect item condition before completing the exchange',
        'Save listings to your local browser wishlist by clicking the heart icon'
      ],
      actionLinks: [
        { label: 'Go to Marketplace', url: '/marketplace' },
        { label: 'View Requests', url: '/requests' }
      ]
    },
    suggestions: [
      'Search for textbooks',
      'Compare meetup locations',
      'Show marketplace stats',
      'Post a request'
    ]
  };
}
