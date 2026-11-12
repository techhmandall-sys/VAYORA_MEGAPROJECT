// Words only the mobile app uses, in Hindi and Marathi. Everything else comes from the web app's
// tables (src/shared, copied by scripts/sync-shared.mjs), so the two read alike: सवारी and यात्री
// in Hindi, प्रवास and प्रवासी in Marathi, चालक in both. Written without review by a native speaker,
// as the web app's tables were. `node scripts/check-translations.mjs` fails if one is missing.

export const extraHi: Record<string, string> = {
  'A message is 1 to 500 characters.': 'संदेश 1 से 500 अक्षरों का होना चाहिए।',
  'A ride is published in one of your vehicles, so passengers know what to look for.':
    'सवारी आपके किसी वाहन में प्रकाशित होती है, ताकि यात्री जानें कि किस गाड़ी को देखना है।',
  Account: 'खाता',
  'Add a stop': 'स्टॉप जोड़ें',
  'Add a vehicle first.': 'पहले एक वाहन जोड़ें।',
  'Address of the VAYORA server': 'VAYORA सर्वर का पता',
  'Administrators use the VAYORA website.': 'प्रशासक VAYORA वेबसाइट का उपयोग करते हैं।',
  'Cannot reach the chat. Check your connection and try again.':
    'चैट से जुड़ नहीं पा रहे। अपना कनेक्शन जाँचें और फिर कोशिश करें।',
  'Choose two different places.': 'दो अलग-अलग जगहें चुनें।',
  'Choose whether you travel as a passenger or drive.': 'चुनें कि आप यात्री के रूप में यात्रा करते हैं या गाड़ी चलाते हैं।',
  'Each stop must be a different place.': 'हर स्टॉप अलग जगह होना चाहिए।',
  'Enter a price for every stretch, 0 for free.': 'हर हिस्से का किराया डालें, मुफ़्त के लिए 0।',
  'Enter a year from 1980': '1980 या उसके बाद का वर्ष डालें',
  'Enter the address of the VAYORA server first.': 'पहले VAYORA सर्वर का पता डालें।',
  'Enter the make and model': 'कंपनी और मॉडल डालें',
  'Enter your email or phone number and your password.': 'अपना ईमेल या फ़ोन नंबर और पासवर्ड डालें।',
  'Every passenger still on board is marked as having travelled.':
    'जो यात्री अब भी सवार हैं, उनकी यात्रा पूरी मानी जाएगी।',
  'Find a seat in a car already making the trip.': 'उसी रास्ते पहले से जा रही कार में सीट पाएँ।',
  Map: 'नक्शा',
  'No bookings yet.': 'अभी तक कोई बुकिंग नहीं।',
  'Nothing is paid now. You pay the driver directly after the ride, in cash or by UPI.':
    'अभी कुछ भुगतान नहीं होता। सवारी के बाद आप चालक को सीधे नकद या UPI से भुगतान करते हैं।',
  'Nothing yet.': 'अभी कुछ नहीं।',
  'Offer the empty seats in your car.': 'अपनी कार की खाली सीटें दें।',
  "On the same Wi-Fi as the laptop running VAYORA: its address and port 8080. Online: the site's https address.":
    'VAYORA चला रहे लैपटॉप वाले उसी Wi-Fi पर: उसका पता और पोर्ट 8080। ऑनलाइन: साइट का https पता।',
  'Only the driver and passengers with a confirmed booking can open this chat.':
    'यह चैट केवल चालक और पक्की बुकिंग वाले यात्री खोल सकते हैं।',
  'Passengers are booked at once.': 'यात्रियों की बुकिंग तुरंत हो जाती है।',
  'Pay your driver {amount}, in cash or by UPI.': 'अपने चालक को {amount} नकद या UPI से दें।',
  'Price per seat': 'प्रति सीट किराया',
  'Reconnecting to the chat. Try again in a moment.': 'चैट से फिर जुड़ रहे हैं। थोड़ी देर में फिर कोशिश करें।',
  Save: 'सहेजें',
  'Seats in the car, yours included': 'कार में सीटें, आपकी सीट मिलाकर',
  Server: 'सर्वर',
  'Slow down: wait a few seconds before sending more.': 'थोड़ा रुकें: और भेजने से पहले कुछ सेकंड इंतज़ार करें।',
  'Stop {n}': 'स्टॉप {n}',
  Swap: 'अदला-बदली करें',
  'The chat is not working right now. Try again later.': 'चैट अभी काम नहीं कर रही है। बाद में फिर कोशिश करें।',
  'The driver answers each request': 'चालक हर अनुरोध का जवाब देता है',
  'The driver is told at once. What you owe follows the cancellation terms you agreed to.':
    'चालक को तुरंत बताया जाता है। आपको कितना देना है, यह आपकी मानी हुई रद्दीकरण शर्तों से तय होता है।',
  'The driver shares their position once the ride is on the road.': 'सवारी शुरू होने पर चालक अपना स्थान साझा करता है।',
  "The driver's position, as they last shared it.": 'चालक का स्थान, जैसा उन्होंने आख़िरी बार साझा किया।',
  'VAYORA needs your location to share it. Allow it in the phone settings.':
    'स्थान साझा करने के लिए VAYORA को आपके स्थान की अनुमति चाहिए। फ़ोन की सेटिंग में अनुमति दें।',
  'You accept or decline each request.': 'आप हर अनुरोध स्वीकार या अस्वीकार करते हैं।',
  'You can sign in again at any time.': 'आप कभी भी फिर से साइन इन कर सकते हैं।',
  'Your passengers are told at once and owe nothing, and they are shown other rides.':
    'आपके यात्रियों को तुरंत बताया जाता है, उन्हें कुछ नहीं देना पड़ता और उन्हें दूसरी सवारियाँ दिखाई जाती हैं।',
  'Your profile, emergency contacts and everything else are on the VAYORA website.':
    'आपकी प्रोफ़ाइल, आपातकालीन संपर्क और बाकी सब कुछ VAYORA वेबसाइट पर है।',
  '{vehicle} added.': '{vehicle} जोड़ा गया।',
};

export const extraMr: Record<string, string> = {
  'A message is 1 to 500 characters.': 'संदेश 1 ते 500 अक्षरांचा असावा.',
  'A ride is published in one of your vehicles, so passengers know what to look for.':
    'प्रवास तुमच्या एखाद्या वाहनात प्रकाशित होतो, म्हणजे प्रवाशांना कोणती गाडी शोधायची ते कळते.',
  Account: 'खाते',
  'Add a stop': 'थांबा जोडा',
  'Add a vehicle first.': 'आधी एक वाहन जोडा.',
  'Address of the VAYORA server': 'VAYORA सर्व्हरचा पत्ता',
  'Administrators use the VAYORA website.': 'प्रशासक VAYORA वेबसाइट वापरतात.',
  'Cannot reach the chat. Check your connection and try again.':
    'चॅटशी जोडता येत नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.',
  'Choose two different places.': 'दोन वेगवेगळी ठिकाणे निवडा.',
  'Choose whether you travel as a passenger or drive.': 'तुम्ही प्रवासी म्हणून प्रवास करता की गाडी चालवता ते निवडा.',
  'Each stop must be a different place.': 'प्रत्येक थांबा वेगळे ठिकाण असावे.',
  'Enter a price for every stretch, 0 for free.': 'प्रत्येक टप्प्याचे भाडे टाका, मोफतसाठी 0.',
  'Enter a year from 1980': '1980 किंवा नंतरचे वर्ष टाका',
  'Enter the address of the VAYORA server first.': 'आधी VAYORA सर्व्हरचा पत्ता टाका.',
  'Enter the make and model': 'कंपनी आणि मॉडेल टाका',
  'Enter your email or phone number and your password.': 'तुमचा ईमेल किंवा फोन नंबर आणि पासवर्ड टाका.',
  'Every passenger still on board is marked as having travelled.':
    'अजून गाडीत असलेल्या प्रत्येक प्रवाशाचा प्रवास पूर्ण झाला असे नोंदवले जाईल.',
  'Find a seat in a car already making the trip.': 'आधीच त्या मार्गाने जाणाऱ्या गाडीत जागा मिळवा.',
  Map: 'नकाशा',
  'No bookings yet.': 'अजून एकही बुकिंग नाही.',
  'Nothing is paid now. You pay the driver directly after the ride, in cash or by UPI.':
    'आत्ता काहीही भरायचे नाही. प्रवासानंतर तुम्ही चालकाला थेट रोख किंवा UPI ने पैसे देता.',
  'Nothing yet.': 'अजून काहीही नाही.',
  'Offer the empty seats in your car.': 'तुमच्या गाडीतील रिकाम्या जागा द्या.',
  "On the same Wi-Fi as the laptop running VAYORA: its address and port 8080. Online: the site's https address.":
    'VAYORA चालवणाऱ्या लॅपटॉपच्या त्याच Wi-Fi वर: त्याचा पत्ता आणि पोर्ट 8080. ऑनलाइन: साइटचा https पत्ता.',
  'Only the driver and passengers with a confirmed booking can open this chat.':
    'ही चॅट फक्त चालक आणि निश्चित बुकिंग असलेले प्रवासी उघडू शकतात.',
  'Passengers are booked at once.': 'प्रवाशांचे बुकिंग लगेच होते.',
  'Pay your driver {amount}, in cash or by UPI.': 'तुमच्या चालकाला {amount} रोख किंवा UPI ने द्या.',
  'Price per seat': 'प्रति जागा भाडे',
  'Reconnecting to the chat. Try again in a moment.': 'चॅटशी पुन्हा जोडले जात आहे. थोड्या वेळाने पुन्हा प्रयत्न करा.',
  Save: 'जतन करा',
  'Seats in the car, yours included': 'गाडीतील जागा, तुमच्या जागेसह',
  Server: 'सर्व्हर',
  'Slow down: wait a few seconds before sending more.': 'थोडे थांबा: आणखी पाठवण्यापूर्वी काही सेकंद थांबा.',
  'Stop {n}': 'थांबा {n}',
  Swap: 'अदलाबदल करा',
  'The chat is not working right now. Try again later.': 'चॅट सध्या चालत नाही. नंतर पुन्हा प्रयत्न करा.',
  'The driver answers each request': 'चालक प्रत्येक विनंतीला उत्तर देतो',
  'The driver is told at once. What you owe follows the cancellation terms you agreed to.':
    'चालकाला लगेच कळवले जाते. तुम्हाला किती द्यावे लागेल ते तुम्ही मान्य केलेल्या रद्द करण्याच्या अटींनुसार ठरते.',
  'The driver shares their position once the ride is on the road.': 'प्रवास सुरू झाल्यावर चालक आपले स्थान शेअर करतो.',
  "The driver's position, as they last shared it.": 'चालकाचे स्थान, त्यांनी शेवटचे शेअर केल्याप्रमाणे.',
  'VAYORA needs your location to share it. Allow it in the phone settings.':
    'स्थान शेअर करण्यासाठी VAYORA ला तुमच्या स्थानाची परवानगी हवी. फोनच्या सेटिंग्जमध्ये ती द्या.',
  'You accept or decline each request.': 'तुम्ही प्रत्येक विनंती स्वीकारता किंवा नाकारता.',
  'You can sign in again at any time.': 'तुम्ही कधीही पुन्हा साइन इन करू शकता.',
  'Your passengers are told at once and owe nothing, and they are shown other rides.':
    'तुमच्या प्रवाशांना लगेच कळवले जाते, त्यांना काहीही द्यावे लागत नाही आणि त्यांना इतर प्रवास दाखवले जातात.',
  'Your profile, emergency contacts and everything else are on the VAYORA website.':
    'तुमचे प्रोफाइल, आपत्कालीन संपर्क आणि बाकी सर्व VAYORA वेबसाइटवर आहे.',
  '{vehicle} added.': '{vehicle} जोडले.',
};
