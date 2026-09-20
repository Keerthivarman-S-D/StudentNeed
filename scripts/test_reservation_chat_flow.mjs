import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const { apiKey, projectId, firestoreDatabaseId } = config;
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents`;

async function getOrAuthUser(email, password) {
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const signRes = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const signData = await signRes.json();
  if (signRes.ok) {
    return { idToken: signData.idToken, localId: signData.localId };
  }

  // Try sign up
  const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  const signUpRes = await fetch(signUpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const upData = await signUpRes.json();
  if (signUpRes.ok) {
    return { idToken: upData.idToken, localId: upData.localId };
  }
  throw new Error(`Failed to auth ${email}: ${JSON.stringify(signData)} / ${JSON.stringify(upData)}`);
}

async function runLiveE2ETest() {
  console.log('===============================================================');
  console.log('  Live E2E Verification: Reservation Authorization & Chat Flow ');
  console.log('===============================================================\n');

  // Authenticate Seller (Student A) and Buyer (Student B)
  console.log('[Setup] Authenticating test accounts...');
  const seller = await getOrAuthUser('student_a_test@student.annauniv.edu', 'P@ssw0rd12345!');
  const buyer = await getOrAuthUser('student_b_test@student.annauniv.edu', 'P@ssw0rd12345!');
  console.log(`[Setup] Seller UID: ${seller.localId}`);
  console.log(`[Setup] Buyer UID:  ${buyer.localId}\n`);

  const results = [];
  function record(step, name, pass, detail) {
    const status = pass ? 'PASS' : 'FAIL';
    results.push({ step, name, status, detail });
    console.log(`[${status}] Step ${step}: ${name} -> ${detail}`);
  }

  // Clean-up timestamps
  const now = new Date();
  const future = new Date(Date.now() + 14 * 24 * 3600 * 1000);

  // Step 1: Seller creates Listing A
  const listingAId = `listing_A_${Date.now()}`;
  const listingARes = await fetch(`${firestoreBase}/listings?documentId=${listingAId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.idToken}` },
    body: JSON.stringify({
      fields: {
        title: { stringValue: 'Scientific Calculator Casio fx-991EX' },
        description: { stringValue: 'Barely used calculator for engineering mathematics' },
        price: { integerValue: '650' },
        type: { stringValue: 'Sale' },
        category: { stringValue: 'Electronics' },
        condition: { stringValue: 'Like New' },
        location: { stringValue: 'Main Campus' },
        sellerId: { stringValue: seller.localId },
        status: { stringValue: 'available' },
        expirationDays: { integerValue: '15' },
        expiresAt: { timestampValue: future.toISOString() },
        createdAt: { timestampValue: now.toISOString() },
        updatedAt: { timestampValue: now.toISOString() },
      }
    })
  });
  record(1, 'Seller creates Listing A', listingARes.ok, `Status ${listingARes.status} (ID: ${listingAId})`);

  // Step 2: Buyer opens Listing A
  const getListingARes = await fetch(`${firestoreBase}/listings/${listingAId}`, {
    headers: { Authorization: `Bearer ${buyer.idToken}` }
  });
  record(2, 'Buyer views Listing A', getListingARes.ok, `Status ${getListingARes.status}`);

  // Step 3: Buyer chats and reserves Listing A
  // Chat A ID calculation: listing_${listingAId}_${[seller, buyer].sort().join('_')}
  const sortedParticipants = [seller.localId, buyer.localId].sort();
  const chatAId = `listing_${listingAId}_${sortedParticipants.join('_')}`;

  const createChatARes = await fetch(`${firestoreBase}/chats?documentId=${chatAId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.idToken}` },
    body: JSON.stringify({
      fields: {
        participants: { arrayValue: { values: [{ stringValue: buyer.localId }, { stringValue: seller.localId }] } },
        listingId: { stringValue: listingAId },
        createdAt: { timestampValue: now.toISOString() },
        updatedAt: { timestampValue: now.toISOString() }
      }
    })
  });
  record(3.1, 'Buyer creates Chat A for Listing A', createChatARes.ok, `Chat ID: ${chatAId}`);

  // Buyer creates Reservation for Listing A
  const reservationAId = `res_${listingAId}_${buyer.localId}`;
  const createResARes = await fetch(`${firestoreBase}/reservations?documentId=${reservationAId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.idToken}` },
    body: JSON.stringify({
      fields: {
        listingId: { stringValue: listingAId },
        buyerId: { stringValue: buyer.localId },
        sellerId: { stringValue: seller.localId },
        chatId: { stringValue: chatAId },
        status: { stringValue: 'pending' },
        createdAt: { timestampValue: now.toISOString() },
        updatedAt: { timestampValue: now.toISOString() }
      }
    })
  });
  record(3.2, 'Buyer creates Reservation A in pending status', createResARes.ok, `Res ID: ${reservationAId}`);

  // Buyer CANNOT accept/reject reservation (must be blocked by Firestore rules)
  const buyerAcceptRes = await fetch(`${firestoreBase}/reservations/${reservationAId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.idToken}` },
    body: JSON.stringify({
      fields: {
        sellerId: { stringValue: seller.localId },
        buyerId: { stringValue: buyer.localId },
        listingId: { stringValue: listingAId },
        chatId: { stringValue: chatAId },
        status: { stringValue: 'accepted' }
      }
    })
  });
  record(4, 'Buyer cannot Accept their own reservation', !buyerAcceptRes.ok, `Correctly rejected: ${buyerAcceptRes.status}`);

  // Step 5: Seller opens reservation and Accepts
  const sellerAcceptRes = await fetch(`${firestoreBase}/reservations/${reservationAId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.idToken}` },
    body: JSON.stringify({
      fields: {
        sellerId: { stringValue: seller.localId },
        buyerId: { stringValue: buyer.localId },
        listingId: { stringValue: listingAId },
        chatId: { stringValue: chatAId },
        status: { stringValue: 'accepted' }
      }
    })
  });
  record(5, 'Seller Accepts Reservation A', sellerAcceptRes.ok, `Status ${sellerAcceptRes.status}`);

  // Step 6: Buyer verifies status is 'accepted'
  const verifyRes = await fetch(`${firestoreBase}/reservations/${reservationAId}`, {
    headers: { Authorization: `Bearer ${buyer.idToken}` }
  });
  const verifyResData = await verifyRes.json();
  const currentStatusA = verifyResData.fields?.status?.stringValue;
  record(6, 'Buyer verifies Reservation A is accepted', currentStatusA === 'accepted', `Current status: ${currentStatusA}`);

  // Step 7: Seller creates Listing B
  const listingBId = `listing_B_${Date.now()}`;
  const listingBRes = await fetch(`${firestoreBase}/listings?documentId=${listingBId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.idToken}` },
    body: JSON.stringify({
      fields: {
        title: { stringValue: 'Engineering Physics Textbook - R. Gaur' },
        description: { stringValue: 'Prescribed Anna University textbook in good condition' },
        price: { integerValue: '350' },
        type: { stringValue: 'Sale' },
        category: { stringValue: 'Textbooks' },
        condition: { stringValue: 'Good' },
        location: { stringValue: 'Central Library' },
        sellerId: { stringValue: seller.localId },
        status: { stringValue: 'available' },
        expirationDays: { integerValue: '15' },
        expiresAt: { timestampValue: future.toISOString() },
        createdAt: { timestampValue: now.toISOString() },
        updatedAt: { timestampValue: now.toISOString() },
      }
    })
  });
  record(7, 'Seller creates Listing B', listingBRes.ok, `Status ${listingBRes.status} (ID: ${listingBId})`);

  // Step 8: Buyer opens Listing B -> Chat
  const chatBId = `listing_${listingBId}_${sortedParticipants.join('_')}`;
  const createChatBRes = await fetch(`${firestoreBase}/chats?documentId=${chatBId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.idToken}` },
    body: JSON.stringify({
      fields: {
        participants: { arrayValue: { values: [{ stringValue: buyer.localId }, { stringValue: seller.localId }] } },
        listingId: { stringValue: listingBId },
        createdAt: { timestampValue: now.toISOString() },
        updatedAt: { timestampValue: now.toISOString() }
      }
    })
  });
  record(8, 'Buyer opens/creates Chat B for Listing B', createChatBRes.ok, `Chat B ID: ${chatBId}`);

  // Step 9: Verify Listing B context and conversation are shown, not Listing A
  const getChatBRes = await fetch(`${firestoreBase}/chats/${chatBId}`, {
    headers: { Authorization: `Bearer ${buyer.idToken}` }
  });
  const chatBData = await getChatBRes.json();
  const linkedListingBId = chatBData.fields?.listingId?.stringValue;
  record(
    9,
    'Verify Chat B points to Listing B, NOT Listing A',
    linkedListingBId === listingBId && chatAId !== chatBId,
    `Linked to: ${linkedListingBId} (Chat A != Chat B)`
  );

  // Step 10: Return to Listing A -> verify its conversation remains separate
  const getChatARes = await fetch(`${firestoreBase}/chats/${chatAId}`, {
    headers: { Authorization: `Bearer ${seller.idToken}` }
  });
  const chatAData = await getChatARes.json();
  const linkedListingAId = chatAData.fields?.listingId?.stringValue;
  record(
    10,
    'Return to Listing A: conversation remains intact and separate',
    linkedListingAId === listingAId,
    `Linked to: ${linkedListingAId} (Untouched)`
  );

  // Cleanup test documents
  console.log('\n[Cleanup] Cleaning up test records...');
  // 1. Cancel reservation A
  await fetch(`${firestoreBase}/reservations/${reservationAId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.idToken}` },
    body: JSON.stringify({
      fields: {
        sellerId: { stringValue: seller.localId },
        buyerId: { stringValue: buyer.localId },
        listingId: { stringValue: listingAId },
        chatId: { stringValue: chatAId },
        status: { stringValue: 'cancelled' }
      }
    })
  });
  // 2. Cancel listing A
  await fetch(`${firestoreBase}/listings/${listingAId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.idToken}` },
    body: JSON.stringify({
      fields: {
        sellerId: { stringValue: seller.localId },
        status: { stringValue: 'cancelled' }
      }
    })
  });
  // 3. Cancel listing B
  await fetch(`${firestoreBase}/listings/${listingBId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.idToken}` },
    body: JSON.stringify({
      fields: {
        sellerId: { stringValue: seller.localId },
        status: { stringValue: 'cancelled' }
      }
    })
  });
  console.log('[Cleanup] Test records cleaned up.\n');

  console.log('===============================================================');
  const allPassed = results.every(r => r.status === 'PASS');
  console.log(`Results: ${results.filter(r => r.status === 'PASS').length}/${results.length} steps passed.`);
  if (!allPassed) {
    console.error('LIVE E2E TEST FAILED!');
    process.exit(1);
  } else {
    console.log('ALL LIVE E2E STEPS COMPLETED AND VERIFIED SUCCESSFULLY!');
  }
}

runLiveE2ETest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

