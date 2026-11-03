// Marathi. Keys are the English strings in the source; placeholders in {braces} must be
// kept exactly. Written without review by a native speaker: the wording on money,
// refunds and safety in particular should be checked before anyone relies on it.

export const mr: Record<string, string> = {
  // Navigation and shell
  'Page not found': 'पान सापडले नाही',
  'There is nothing at this address.': 'या पत्त्यावर काहीही नाही.',
  'Find a ride': 'प्रवास शोधा',
  'My bookings': 'माझी बुकिंग',
  'My rides': 'माझे प्रवास',
  'Publish a ride': 'प्रवास प्रकाशित करा',
  'My vehicles': 'माझी वाहने',
  Earnings: 'कमाई',
  Overview: 'आढावा',
  Reports: 'तक्रारी',
  Members: 'सदस्य',
  'Booking durability': 'बुकिंगची स्थिरता',
  'Audit log': 'ऑडिट नोंदी',
  Notifications: 'सूचना',
  unread: 'न वाचलेल्या',
  Language: 'भाषा',
  'Skip to content': 'थेट मजकुराकडे जा',
  Main: 'मुख्य',
  'Sign out': 'साइन आउट',
  'Keep it': 'राहू द्या',
  'Loading…': 'लोड होत आहे…',
  'Try again': 'पुन्हा प्रयत्न करा',
  Reload: 'पुन्हा लोड करा',
  'This screen could not be loaded. VAYORA may have been updated: reload to get the new version.':
    'ही स्क्रीन लोड होऊ शकली नाही. VAYORA कदाचित अपडेट झाले आहे: नवीन आवृत्ती मिळवण्यासाठी पुन्हा लोड करा.',
  'Week of {date}':
    '{date} चा आठवडा',
  'Fewer seats':
    'कमी जागा',
  'More seats':
    'जास्त जागा',
  'Light':
    'फिकट',
  'Dark':
    'गडद',
  'Match device':
    'डिव्हाइसप्रमाणे',
  'Theme: {name}':
    'थीम: {name}',
  // Staff checks of identity documents and insurance
  'Declare an identity document first':
    'आधी ओळखपत्र जाहीर करा',
  "Declare this car's insurance first":
    'आधी या कारचा विमा जाहीर करा',
  'Say which car the insurance is for':
    'विमा कोणत्या कारसाठी आहे ते सांगा',
  'This is already waiting for VAYORA staff':
    'हे आधीच VAYORA कर्मचाऱ्यांकडे प्रतीक्षेत आहे',
  'VAYORA staff have already checked this':
    'VAYORA कर्मचाऱ्यांनी हे आधीच तपासले आहे',
  'No check is waiting with that id':
    'या आयडीची कोणतीही तपासणी प्रतीक्षेत नाही',
  'Say why it could not be confirmed':
    'याची पुष्टी का होऊ शकली नाही ते सांगा',
  'VAYORA staff have checked your identity document.':
    'VAYORA कर्मचाऱ्यांनी तुमचे ओळखपत्र तपासले आहे.',
  'VAYORA staff could not confirm your identity document: {note}':
    'VAYORA कर्मचारी तुमच्या ओळखपत्राची पुष्टी करू शकले नाहीत: {note}',
  'VAYORA staff have checked the insurance for {vehicle}.':
    'VAYORA कर्मचाऱ्यांनी {vehicle} चा विमा तपासला आहे.',
  'VAYORA staff could not confirm the insurance for {vehicle}: {note}':
    'VAYORA कर्मचारी {vehicle} च्या विम्याची पुष्टी करू शकले नाहीत: {note}',
  'Ask VAYORA staff to check it':
    'VAYORA कर्मचाऱ्यांना हे तपासण्यास सांगा',
  'You show the original to VAYORA staff, in person or on a video call. They record only the result: no number and no copy is kept.':
    'तुम्ही मूळ कागदपत्र VAYORA कर्मचाऱ्यांना दाखवता, प्रत्यक्ष किंवा व्हिडिओ कॉलवर. ते फक्त निकाल नोंदवतात: कोणताही क्रमांक किंवा प्रत ठेवली जात नाही.',
  'Waiting for VAYORA staff. They will contact you to see the original.':
    'VAYORA कर्मचाऱ्यांची प्रतीक्षा आहे. मूळ कागदपत्र पाहण्यासाठी ते तुमच्याशी संपर्क साधतील.',
  'Checked by VAYORA staff on {date}. A person saw it; it was not checked with its issuer.':
    '{date} रोजी VAYORA कर्मचाऱ्यांनी तपासले. एका व्यक्तीने ते पाहिले; ते देणाऱ्या संस्थेकडे तपासलेले नाही.',
  'VAYORA staff could not confirm it: {note}':
    'VAYORA कर्मचारी याची पुष्टी करू शकले नाहीत: {note}',
  '{document}, checked by VAYORA staff':
    '{document}, VAYORA कर्मचाऱ्यांनी तपासलेले',
  'A person at VAYORA saw this document. It was not checked with its issuer.':
    'VAYORA मधील एका व्यक्तीने हे कागदपत्र पाहिले. ते देणाऱ्या संस्थेकडे तपासलेले नाही.',
  'Identity checked by staff':
    'कर्मचाऱ्यांनी ओळख तपासली',
  'Insurance: {insurer}, until {date}. VAYORA staff saw the policy; it was not checked with the insurer.':
    'विमा: {insurer}, {date} पर्यंत. VAYORA कर्मचाऱ्यांनी पॉलिसी पाहिली; विमा कंपनीकडे तपासलेली नाही.',
  'Have a driver whose identity VAYORA staff have checked':
    'ज्याची ओळख VAYORA कर्मचाऱ्यांनी तपासली आहे असा चालक असावा',
  'Document checks':
    'कागदपत्र तपासणी',
  'Ask the driver to show you the original, in person or on a video call, then record what you saw. Do not write down its number or keep a copy. This says a person saw it, not that its issuer stands behind it.':
    'चालकाला मूळ कागदपत्र दाखवण्यास सांगा, प्रत्यक्ष किंवा व्हिडिओ कॉलवर, मग तुम्ही काय पाहिले ते नोंदवा. त्याचा क्रमांक लिहू नका किंवा प्रत ठेवू नका. यावरून एका व्यक्तीने ते पाहिले हे कळते, ते देणारी संस्था त्याची हमी देते असे नाही.',
  'No document is waiting to be checked.':
    'कोणतेही कागदपत्र तपासणीच्या प्रतीक्षेत नाही.',
  'Identity document: {document}':
    'ओळखपत्र: {document}',
  'Insurance for {vehicle}: {insurer}, until {date}':
    '{vehicle} चा विमा: {insurer}, {date} पर्यंत',
  'Asked {when}':
    '{when} रोजी विनंती केली',
  'Note for the driver (needed to refuse)':
    'चालकासाठी टीप (नाकारण्यासाठी आवश्यक)',
  'Mark as checked':
    'तपासले म्हणून नोंदवा',
  'Yes, I saw the original':
    'होय, मी मूळ कागदपत्र पाहिले',
  'Could not confirm':
    'पुष्टी होऊ शकली नाही',
  // Publishing a ride, in numbered parts
  'When, and in which car':
    'कधी, आणि कोणत्या कारने',
  'Where you stop':
    'तुम्ही कुठे थांबता',
  'Who rides, and how':
    'कोण येते, आणि कसे',
  'Return and repeat':
    'परतीचा प्रवास आणि पुनरावृत्ती',
  'Your ride':
    'तुमचा प्रवास',
  'Not chosen yet':
    'अजून निवडलेले नाही',
  'Leaving':
    'निघण्याची वेळ',
  'Whole way, per seat':
    'संपूर्ण मार्ग, प्रति सीट',
  'Rides to publish':
    'प्रकाशित होणारे प्रवास',
  // Command palette
  'Go to…':
    'इथे जा…',
  'Search pages and actions':
    'पाने आणि क्रिया शोधा',
  'Pages':
    'पाने',
  'Theme':
    'थीम',
  'Actions':
    'क्रिया',
  'Nothing matches that.':
    'याच्याशी काहीही जुळत नाही.',
  'Arrows to move, Enter to choose, Esc to close':
    'फिरण्यासाठी बाण, निवडण्यासाठी Enter, बंद करण्यासाठी Esc',
  'More':
    'अधिक',
  'Something went wrong on this screen.':
    'या स्क्रीनवर काहीतरी चूक झाली.',

  // Payments and cancelling
  'If you cancel': 'तुम्ही रद्द केल्यास',
  '{hours} hours or more before boarding': 'बसण्याच्या {hours} तास किंवा त्याहून आधी',
  '{from} to {to} hours before boarding': 'बसण्याच्या {from} ते {to} तास आधी',

  // Ratings
  'No ratings yet': 'अद्याप रेटिंग नाही',
  '{average} out of 5 · {count} rating': '5 पैकी {average} · {count} रेटिंग',
  '{average} out of 5 · {count} ratings': '5 पैकी {average} · {count} रेटिंग',
  '{n} star': '{n} स्टार',
  '{n} stars': '{n} स्टार',
  'Comment (optional, shown on their profile)': 'टिप्पणी (ऐच्छिक, त्यांच्या प्रोफाइलवर दिसेल)',
  'Sending…': 'पाठवत आहे…',
  'Send rating': 'रेटिंग पाठवा',
  'Rate your driver': 'तुमच्या चालकाला रेटिंग द्या',
  'Rate {name}': '{name} यांना रेटिंग द्या',

  // Reports
  'Unsafe driving': 'असुरक्षित ड्रायव्हिंग',
  Harassment: 'छळ',
  'Did not turn up': 'आले नाहीत',
  Fraud: 'फसवणूक',
  'Something else': 'इतर काही',
  'Your report has been sent to the administrators. They will not tell {name} who filed it.':
    'तुमची तक्रार प्रशासकांकडे पाठवली आहे. तक्रार कोणी केली हे ते {name} यांना सांगणार नाहीत.',
  'Report {name}': '{name} यांची तक्रार करा',
  'What happened?': 'काय झाले?',
  'Choose one': 'एक निवडा',
  'Details (optional)': 'तपशील (ऐच्छिक)',
  'If you are in danger now, call 112. A report here is read by an administrator later, not straight away.':
    'तुम्ही आत्ता धोक्यात असाल तर 112 वर कॉल करा. येथे केलेली तक्रार प्रशासक नंतर वाचतात, लगेच नाही.',
  'Send report': 'तक्रार पाठवा',
  'Never mind': 'राहू द्या',

  // Statuses
  'Waiting for the driver': 'चालकाच्या उत्तराची प्रतीक्षा',
  Confirmed: 'निश्चित झाली',
  'Declined by the driver': 'चालकाने नाकारली',
  Cancelled: 'रद्द',
  Completed: 'पूर्ण झाली',
  'Did not board': 'बसले नाहीत',
  Scheduled: 'नियोजित',
  'On the road': 'प्रवासात',

  // Places and units
  Kolhapur: 'कोल्हापूर',
  Karad: 'कराड',
  Satara: 'सातारा',
  Pune: 'पुणे',
  '{n} m': '{n} मी',
  '{n} km': '{n} किमी',
  '{m} min': '{m} मिनिटे',
  '{h} h': '{h} तास',
  '{h} h {m} min': '{h} तास {m} मिनिटे',

  // Validation
  'Enter your email': 'तुमचा ईमेल टाका',
  'Enter a valid email': 'वैध ईमेल टाका',
  'Enter your password': 'तुमचा पासवर्ड टाका',
  'Enter your name': 'तुमचे नाव टाका',
  'Use at least 8 characters': 'किमान 8 अक्षरे वापरा',
  'Use at most 72 characters': 'जास्तीत जास्त 72 अक्षरे वापरा',
  'Choose how you will use VAYORA': 'तुम्ही VAYORA कसे वापरणार ते निवडा',
  'Choose where you start': 'तुम्ही कुठून निघणार ते निवडा',
  'Choose where you are going': 'तुम्ही कुठे जाणार ते निवडा',
  'Choose a date': 'तारीख निवडा',
  'At least 1 seat': 'किमान 1 जागा',
  'At most 8 seats': 'जास्तीत जास्त 8 जागा',
  'Enter the make': 'कंपनीचे नाव टाका',
  'Enter the model': 'मॉडेल टाका',
  'Too old': 'खूप जुने',
  'Check the year': 'वर्ष तपासा',
  'At least 2, counting the driver': 'चालकासह किमान 2',
  'At most 9': 'जास्तीत जास्त 9',
  'Choose a vehicle': 'वाहन निवडा',
  'Choose when you leave': 'तुम्ही केव्हा निघणार ते निवडा',
  'Offer at least 1 seat': 'किमान 1 जागा द्या',
  'Choose a time in the future': 'पुढील वेळ निवडा',
  'A ride needs at least two stops': 'प्रवासात किमान दोन थांबे हवेत',
  'Enter whole minutes, up to two days': 'पूर्ण मिनिटे टाका, जास्तीत जास्त दोन दिवस',
  'Enter a price of 0 or more': '0 किंवा त्याहून जास्त किंमत टाका',
  'Must be later than the stop before': 'आधीच्या थांब्यानंतरचे असायला हवे',

  // Booking durability (administrator)
  "Each figure is a model's estimate that the passenger will not cancel before departure. The model was trained on simulated data only and separates risky from safe bookings weakly. It is not a fact about any person and must not be used to decline, penalise or price anyone. It is used for one thing: choosing whom the seat-release reminder asks.":
    'प्रत्येक आकडा म्हणजे प्रवासी निघण्यापूर्वी बुकिंग रद्द करणार नाही याचा मॉडेलने केलेला अंदाज आहे. मॉडेल केवळ कृत्रिम (सिम्युलेटेड) डेटावर प्रशिक्षित केले आहे आणि ते जोखमीच्या व सुरक्षित बुकिंगमध्ये फारसा फरक करू शकत नाही. हे कोणत्याही व्यक्तीबद्दलचे तथ्य नाही आणि कोणालाही नाकारण्यासाठी, दंड करण्यासाठी किंवा किंमत ठरवण्यासाठी याचा वापर करू नये. त्याचा वापर फक्त एका गोष्टीसाठी होतो: जागा सोडण्याची आठवण कोणाला पाठवायची ते निवडणे.',
  'Scoring…': 'अंदाज काढत आहे…',
  'Score bookings now': 'आत्ता बुकिंगचा अंदाज काढा',
  'Another scoring run is in progress.': 'अंदाज काढण्याची दुसरी प्रक्रिया आधीच सुरू आहे.',
  '{scored} scored, {already} already scored today, {failed} could not be scored.':
    '{scored} चा अंदाज काढला, {already} चा आज आधीच काढला होता, {failed} चा काढता आला नाही.',
  'The model service did not answer for some bookings. They are unchanged; run it again later.':
    'काही बुकिंगसाठी मॉडेल सेवेने उत्तर दिले नाही. त्या जशाच्या तशा आहेत; नंतर पुन्हा चालवा.',
  'No confirmed booking has been scored yet.': 'अद्याप कोणत्याही निश्चित बुकिंगचा अंदाज काढलेला नाही.',
  'Latest durability estimate of each confirmed booking': 'प्रत्येक निश्चित बुकिंगचा सर्वात अलीकडील स्थिरता अंदाज',
  Booking: 'बुकिंग',
  Passenger: 'प्रवासी',
  Trip: 'प्रवास',
  Leaves: 'निघण्याची वेळ',
  Estimate: 'अंदाज',
  Model: 'मॉडेल',
  Scored: 'अंदाजाची वेळ',

  // Signing in
  'Sign in': 'साइन इन करा',
  Email: 'ईमेल',
  Password: 'पासवर्ड',
  'Signing in…': 'साइन इन होत आहे…',
  'New here?': 'पहिल्यांदाच आला आहात?',
  'Create an account': 'खाते तयार करा',
  'Full name': 'पूर्ण नाव',
  'At least 8 characters.': 'किमान 8 अक्षरे.',
  'I want to': 'मला हे करायचे आहे',
  'An account is either a passenger or a driver. This cannot be changed later.':
    'खाते एकतर प्रवाशाचे असते किंवा चालकाचे. हे नंतर बदलता येत नाही.',
  'Find rides as a passenger': 'प्रवासी म्हणून प्रवास शोधणे',
  'Offer rides as a driver': 'चालक म्हणून प्रवास देणे',
  'Creating…': 'तयार करत आहे…',
  'Create account': 'खाते तयार करा',
  'Already have an account?': 'आधीच खाते आहे?',

  // Back office
  Passengers: 'प्रवासी',
  Drivers: 'चालक',
  Administrators: 'प्रशासक',
  Driver: 'चालक',
  Administrator: 'प्रशासक',
  'None yet.': 'अद्याप काही नाही.',
  '{n} report is waiting.': '{n} तक्रार प्रलंबित आहे.',
  '{n} reports are waiting.': '{n} तक्रारी प्रलंबित आहेत.',
  'Open the queue': 'यादी उघडा',
  'Members by role': 'भूमिकेनुसार सदस्य',
  'Rides by status': 'स्थितीनुसार प्रवास',
  'Bookings by status': 'स्थितीनुसार बुकिंग',
  'Suspended members: {n}': 'निलंबित सदस्य: {n}',
  'No reports are waiting.': 'कोणतीही तक्रार प्रलंबित नाही.',
  '{reason}: {reporter} about': '{reason}: {reporter} यांनी तक्रार केली, यांच्याबद्दल:',
  'Filed {time}': '{time} रोजी नोंदवली',
  'booking #{id}': 'बुकिंग #{id}',
  'Note for report #{id}': 'तक्रार #{id} साठी टीप',
  'Kept with the report. Sent to the member if you warn them.':
    'तक्रारीसोबत ठेवली जाते. तुम्ही सदस्याला ताकीद दिल्यास त्यांना पाठवली जाते.',
  Dismiss: 'फेटाळा',
  'Warn member': 'सदस्याला ताकीद द्या',
  'Suspend member': 'सदस्याला निलंबित करा',
  'Yes, suspend {name}': 'होय, {name} यांना निलंबित करा',
  'Name, email or phone': 'नाव, ईमेल किंवा फोन',
  Search: 'शोधा',
  'No member matches.': 'एकही सदस्य सापडला नाही.',
  'Members, newest first': 'सदस्य, सर्वात नवीन आधी',
  Name: 'नाव',
  Role: 'भूमिका',
  Joined: 'सामील झाले',
  Standing: 'स्थिती',
  Suspended: 'निलंबित',
  'Reinstate {name}': '{name} यांना पुन्हा सक्रिय करा',
  Active: 'सक्रिय',
  'Every administrative action, newest first. Entries cannot be edited or removed.':
    'प्रत्येक प्रशासकीय कृती, सर्वात नवीन आधी. नोंदी बदलता किंवा काढता येत नाहीत.',
  'No administrative action has been recorded.': 'कोणतीही प्रशासकीय कृती नोंदवलेली नाही.',
  'Administrative actions': 'प्रशासकीय कृती',
  When: 'केव्हा',
  Who: 'कोणी',
  Action: 'कृती',
  On: 'कशावर',
  Detail: 'तपशील',

  // Vehicles
  'Add a vehicle before you publish a ride.': 'प्रवास प्रकाशित करण्यापूर्वी एक वाहन जोडा.',
  '{n} seats including yours': 'तुमच्या जागेसह {n} जागा',
  'Add a vehicle': 'वाहन जोडा',
  Make: 'कंपनी',
  'Year (optional)': 'वर्ष (ऐच्छिक)',
  'Colour (optional)': 'रंग (ऐच्छिक)',
  Seats: 'जागा',
  "Every seat in the vehicle, counting the driver's.": 'वाहनातील प्रत्येक जागा, चालकाच्या जागेसह.',
  'Adding…': 'जोडत आहे…',
  'Add vehicle': 'वाहन जोडा',

  // Publishing a ride
  'Route and meeting points': 'मार्ग आणि भेटण्याची ठिकाणे',
  'A click on the map moves the meeting point for': 'नकाशावर क्लिक केल्यास याचे भेटण्याचे ठिकाण बदलेल',
  'Each starts at the town centre. Put it where passengers should actually find you.':
    'प्रत्येक ठिकाण सुरुवातीला शहराच्या मध्यभागी असते. प्रवाशांनी तुम्हाला प्रत्यक्षात जिथे भेटावे तिथे ते ठेवा.',
  '{town} meeting point': '{town} येथील भेटण्याचे ठिकाण',
  'Map of your stops: {stops}': 'तुमच्या थांब्यांचा नकाशा: {stops}',
  'Working out the route…': 'मार्ग काढत आहे…',
  'Work out the route': 'मार्ग काढा',
  'Use the suggested prices and times': 'सुचवलेल्या किमती आणि वेळा वापरा',
  '{km} km by road, about {time} of driving.': 'रस्त्याने {km} किमी, सुमारे {time} ड्रायव्हिंग.',
  'About {km} km in a straight line. No road route is available for this trip, so this is not a road distance and the times are rough guesses.':
    'सरळ रेषेत सुमारे {km} किमी. या प्रवासासाठी रस्त्याचा मार्ग उपलब्ध नाही, त्यामुळे हे रस्त्याचे अंतर नाही आणि वेळा केवळ ढोबळ अंदाज आहेत.',
  '{from} to {to}: {km} km, {time}, suggested {price} a seat': '{from} ते {to}: {km} किमी, {time}, सुचवलेली किंमत प्रति जागा {price}',
  'The suggestion is distance times a flat rate. The price is yours to set.':
    'ही सूचना अंतराला एका ठरावीक दराने गुणून काढली आहे. किंमत ठरवणे तुमच्या हातात आहे.',
  'You need a vehicle first.': 'आधी तुम्हाला एक वाहन हवे.',
  'Add one': 'वाहन जोडा',
  Vehicle: 'वाहन',
  '{vehicle} ({n} passenger seats)': '{vehicle} ({n} प्रवासी जागा)',
  'Leaving at': 'निघण्याची वेळ',
  "In your device's local time.": 'तुमच्या डिव्हाइसच्या स्थानिक वेळेनुसार.',
  'Seats offered': 'देऊ केलेल्या जागा',
  'Confirm bookings instantly, without asking me': 'मला न विचारता बुकिंग लगेच निश्चित करा',
  'Stops and price per seat': 'थांबे आणि प्रति जागा किंमत',
  'Passengers can book between any two of your stops. Each price is for the stretch that ends at that stop.':
    'प्रवासी तुमच्या कोणत्याही दोन थांब्यांदरम्यान बुकिंग करू शकतात. प्रत्येक किंमत त्या थांब्यावर संपणाऱ्या टप्प्याची आहे.',
  'Price to {town} (₹)': '{town} पर्यंतची किंमत (₹)',
  'Publishing…': 'प्रकाशित करत आहे…',
  'Publish ride': 'प्रवास प्रकाशित करा',

  // A driver's rides
  'You have not published a ride yet.': 'तुम्ही अद्याप एकही प्रवास प्रकाशित केलेला नाही.',
  'Leaves {time}': 'निघण्याची वेळ {time}',
  'Instant booking': 'त्वरित बुकिंग',
  'You approve requests': 'विनंत्या तुम्ही मंजूर करता',
  '{km} km by road, about {time}': 'रस्त्याने {km} किमी, सुमारे {time}',
  'About {km} km in a straight line (road distance unavailable)': 'सरळ रेषेत सुमारे {km} किमी (रस्त्याचे अंतर उपलब्ध नाही)',
  'Start ride': 'प्रवास सुरू करा',
  'Cancel ride': 'प्रवास रद्द करा',
  'Yes, cancel for everyone': 'होय, सर्वांसाठी रद्द करा',
  'Complete ride': 'प्रवास पूर्ण करा',
  'Yes, we have arrived': 'होय, आम्ही पोहोचलो आहोत',
  '{from} → {to}: {free} of {total} seats free, {price}': '{from} → {to}: {total} पैकी {free} जागा रिकाम्या, {price}',
  'Hide passengers': 'प्रवासी लपवा',
  'Show passengers': 'प्रवासी दाखवा',
  'Nobody has booked this ride yet.': 'अद्याप कोणीही हा प्रवास बुक केलेला नाही.',
  '{from} → {to} · boards {time} · {n} seat · {price}': '{from} → {to} · {time} ला बसणार · {n} जागा · {price}',
  '{from} → {to} · boards {time} · {n} seats · {price}': '{from} → {to} · {time} ला बसणार · {n} जागा · {price}',
  Accept: 'स्वीकारा',
  Decline: 'नाकारा',
  'Yes, mark as no-show': 'होय, गैरहजर म्हणून नोंदवा',

  // Earnings
  'Trip completed': 'प्रवास पूर्ण झाला',
  'Passenger did not board': 'प्रवासी बसला नाही',
  'Passenger cancelled late': 'प्रवाशाने उशिरा रद्द केले',
  Paid: 'रक्कम दिल्याची तारीख',
  Why: 'कारण',
  Amount: 'रक्कम',

  // Notifications
  'Mark all as read': 'सर्व वाचलेल्या म्हणून नोंदवा',
  'You have no notifications.': 'तुमच्यासाठी कोणतीही सूचना नाही.',
  'Unread:': 'न वाचलेली:',
  'Mark as read': 'वाचलेली म्हणून नोंदवा',

  // Search and booking
  'Board here: {stop}': 'येथे बसा: {stop}',
  'Get off here: {stop}': 'येथे उतरा: {stop}',
  'Map of the ride through {stops}': '{stops} मार्गे जाणाऱ्या प्रवासाचा नकाशा',
  'Board at {stop}, leaving {time}.': '{stop} येथे बसा, निघण्याची वेळ {time}.',
  'The whole ride is {km} km by road.': 'संपूर्ण प्रवास रस्त्याने {km} किमी आहे.',
  'The whole ride is about {km} km in a straight line; the road distance is not available.':
    'संपूर्ण प्रवास सरळ रेषेत सुमारे {km} किमी आहे; रस्त्याचे अंतर उपलब्ध नाही.',
  'Your start': 'तुमचे सुरुवातीचे ठिकाण',
  'Your destination': 'तुमचे गंतव्यस्थान',
  'Start: the centre of {town}': 'सुरुवात: {town} चा मध्यभाग',
  'Destination: the centre of {town}': 'गंतव्यस्थान: {town} चा मध्यभाग',
  'Start: a point you chose ({lat}, {lon})': 'सुरुवात: तुम्ही निवडलेले ठिकाण ({lat}, {lon})',
  'Destination: a point you chose ({lat}, {lon})': 'गंतव्यस्थान: तुम्ही निवडलेले ठिकाण ({lat}, {lon})',
  'Use the centre of {town} instead': 'त्याऐवजी {town} चा मध्यभाग वापरा',
  From: 'कुठून',
  To: 'कुठे',
  Date: 'तारीख',
  'Rides are matched to the centre of each town unless you choose an exact point. Only rides with a stop near each end, or whose driver will come to your start, are shown.':
    'तुम्ही अचूक ठिकाण निवडले नाही तर प्रवास प्रत्येक शहराच्या मध्यभागानुसार जुळवले जातात. दोन्ही टोकांजवळ थांबा असलेले, किंवा ज्यांचा चालक तुमच्या सुरुवातीच्या ठिकाणी येईल, तेच प्रवास दाखवले जातात.',
  'Hide the map': 'नकाशा लपवा',
  'Choose exact points on a map': 'नकाशावर अचूक ठिकाणे निवडा',
  'Which point a click on the map sets': 'नकाशावर क्लिक केल्यास कोणते ठिकाण ठरेल',
  'A click sets my start': 'क्लिकने माझे सुरुवातीचे ठिकाण ठरवा',
  'A click sets my destination': 'क्लिकने माझे गंतव्यस्थान ठरवा',
  'Booked. {from} to {to}, leaving {time}.': 'बुक झाले. {from} ते {to}, निघण्याची वेळ {time}.',
  'Request sent. Your seats are held while the driver decides; see My bookings.':
    'विनंती पाठवली. चालक निर्णय घेईपर्यंत तुमच्या जागा राखून ठेवल्या आहेत; "माझी बुकिंग" पहा.',
  'Search results': 'शोधाचे निकाल',
  'No rides have a stop near both ends on that day with that many seats. Try another date or other points.':
    'त्या दिवशी, तितक्या जागांसह, दोन्ही टोकांजवळ थांबा असलेला एकही प्रवास नाही. दुसरी तारीख किंवा दुसरी ठिकाणे वापरून पहा.',
  'Sort by': 'क्रम',
  'Earliest departure': 'सर्वात आधी निघणारा',
  'Lowest price': 'सर्वात कमी किंमत',
  'Best-rated driver': 'सर्वोत्तम रेटिंग असलेला चालक',
  'Nearest pickup': 'सर्वात जवळचे पिकअप',
  UPI: 'UPI',
  '{n} seat left': '{n} जागा शिल्लक',
  '{n} seats left': '{n} जागा शिल्लक',
  'Confirms instantly': 'लगेच निश्चित होते',
  'Driver approves each request': 'चालक प्रत्येक विनंती मंजूर करतो',
  'Pickup {pickup} from your start · drop-off {dropoff} from your destination':
    'पिकअप तुमच्या सुरुवातीच्या ठिकाणापासून {pickup} · ड्रॉप तुमच्या गंतव्यस्थानापासून {dropoff}',
  Book: 'बुक करा',
  Request: 'विनंती करा',
  'Hide route': 'मार्ग लपवा',
  'Show route': 'मार्ग दाखवा',
  'You have no bookings yet.': 'तुमची अद्याप एकही बुकिंग नाही.',
  'Leaves {time} · {n} seat': 'निघण्याची वेळ {time} · {n} जागा',
  'Leaves {time} · {n} seats': 'निघण्याची वेळ {time} · {n} जागा',
  'Fare {amount}': 'भाडे {amount}',
  'Hide meeting point': 'भेटण्याचे ठिकाण लपवा',
  'Show meeting point': 'भेटण्याचे ठिकाण दाखवा',
  'Cancel booking': 'बुकिंग रद्द करा',
  'Yes, cancel it': 'होय, रद्द करा',

  // Profile
  Member: 'सदस्य',
  'Driver since': 'चालक, या वेळेपासून',
  'Passenger since': 'प्रवासी, या वेळेपासून',
  'Completed trips': 'पूर्ण केलेले प्रवास',
  Rating: 'रेटिंग',
  Reviews: 'अभिप्राय',
  'Nobody has written a review yet.': 'अद्याप कोणीही अभिप्राय लिहिलेला नाही.',
  '{stars} out of 5 · {reviewer} · {date}': '5 पैकी {stars} · {reviewer} · {date}',

  // Chat and live position
  'That message cannot be sent. Check it is not empty or too long.':
    'हा संदेश पाठवता येत नाही. तो रिकामा किंवा खूप मोठा नाही ना ते तपासा.',
  'The connection was lost. Close the chat and open it again.':
    'संपर्क तुटला. चॅट बंद करून पुन्हा उघडा.',
  'You are no longer on this ride.':
    'तुम्ही आता या प्रवासात नाही.',
  'You are sending messages too quickly. Wait a moment.':
    'तुम्ही खूप वेगाने संदेश पाठवत आहात. थोडा वेळ थांबा.',
  'Only the driver can share a position.':
    'फक्त चालकच आपले स्थान शेअर करू शकतो.',
  'A position can only be shared while the ride is under way.':
    'प्रवास सुरू असतानाच स्थान शेअर करता येते.',
  'That could not be sent. Try again.':
    'ते पाठवता आले नाही. पुन्हा प्रयत्न करा.',
  'The chat service cannot be reached. Try again.':
    'चॅट सेवेशी संपर्क होत नाही. पुन्हा प्रयत्न करा.',
  'This device cannot report its position.':
    'हे डिव्हाइस आपले स्थान सांगू शकत नाही.',
  'Your position is not available. Check that location access is allowed.':
    'तुमचे स्थान उपलब्ध नाही. स्थानाची परवानगी दिली आहे का ते तपासा.',
  'Your position cannot be found just now. Sharing stays on and carries on once it is found.':
    'तुमचे स्थान आत्ता सापडत नाही. शेअर करणे चालू राहील आणि स्थान सापडताच पुन्हा सुरू होईल.',
  'Stop sharing my position':
    'माझे स्थान शेअर करणे थांबवा',
  'Share my position with passengers':
    'प्रवाशांसोबत माझे स्थान शेअर करा',
  'Passengers on this ride can see where you are until you stop or the ride ends.':
    'तुम्ही थांबवेपर्यंत किंवा प्रवास संपेपर्यंत या प्रवासातील प्रवासी तुम्ही कुठे आहात ते पाहू शकतात.',
  'Connecting…':
    'जोडत आहे…',
  'The chat is only for the driver and passengers booked on this ride.':
    'चॅट फक्त चालक आणि या प्रवासाची बुकिंग असलेल्या प्रवाशांसाठी आहे.',
  "The driver's position at {time}":
    '{time} वाजता चालकाचे स्थान',
  'The driver':
    'चालक',
  "Map showing the driver's last known position":
    'चालकाचे शेवटचे माहीत असलेले स्थान दाखवणारा नकाशा',
  'Messages':
    'संदेश',
  'No messages yet.':
    'अद्याप एकही संदेश नाही.',
  'You':
    'तुम्ही',
  'Message everyone on this ride':
    'या प्रवासातील सर्वांना संदेश पाठवा',
  'Send':
    'पाठवा',
  'Open chat':
    'चॅट उघडा',
  'Close chat':
    'चॅट बंद करा',
  // Account, verification and emergencies
  'My account':
    'माझे खाते',
  'Emergency':
    'आणीबाणी',
  'Emergencies':
    'आणीबाणीच्या घटना',
  'If you are in danger, call 112 now.':
    'तुम्ही धोक्यात असाल तर आत्ताच 112 वर कॉल करा.',
  'Call 112':
    '112 वर कॉल करा',
  'You can also alert the VAYORA administrators. They see it in a queue; they are not an emergency service.':
    'तुम्ही VAYORA च्या प्रशासकांनाही कळवू शकता. त्यांना ते एका यादीत दिसते; ते आपत्कालीन सेवा नाहीत.',
  'Send an alert':
    'सूचना पाठवा',
  'Close':
    'बंद करा',
  'Your alert is recorded and the administrators can see it.':
    'तुमची सूचना नोंदवली आहे आणि प्रशासक ती पाहू शकतात.',
  'A message was sent to {n} of your emergency contacts.':
    'तुमच्या {n} आपत्कालीन संपर्कांना संदेश पाठवला.',
  'Text messages are simulated in this project: your emergency contacts were NOT messaged. Call them yourself, or call 112.':
    'या प्रकल्पात SMS फक्त सिम्युलेटेड आहेत: तुमच्या आपत्कालीन संपर्कांना संदेश पाठवला गेला नाही. त्यांना स्वतः कॉल करा, किंवा 112 वर कॉल करा.',
  'Prefers a quiet ride':
    'शांत प्रवास आवडतो',
  'Happy with some conversation':
    'थोड्या गप्पा चालतील',
  'Likes to talk':
    'गप्पा मारायला आवडते',
  'Fine with smoking':
    'धूम्रपान चालेल',
  'No smoking':
    'धूम्रपान नको',
  'Fine with pets':
    'पाळीव प्राणी चालतील',
  'No pets':
    'पाळीव प्राणी नकोत',
  'Likes music on the way':
    'प्रवासात संगीत आवडते',
  'Prefers no music':
    'संगीत नको',
  'About this member':
    'या सदस्याविषयी',
  'About {n} years old':
    'सुमारे {n} वर्षे',
  'Email confirmed':
    'ईमेलची खात्री झाली',
  'Phone confirmed':
    'फोनची खात्री झाली',
  'VAYORA has not checked any identity documents.':
    'VAYORA ने कोणतीही ओळखपत्रे तपासलेली नाहीत.',
  'Enter 10 to 15 digits, with or without a + in front':
    '10 ते 15 अंक लिहा, सुरुवातीला + असो वा नसो',
  'Not said':
    'सांगितले नाही',
  'Fine with me':
    'मला चालेल',
  'No, please':
    'कृपया नको',
  'Your profile is saved.':
    'तुमची प्रोफाइल जतन झाली.',
  'Phone number':
    'फोन नंबर',
  'Never shown to other members. Changing it means confirming it again.':
    'इतर सदस्यांना कधीही दाखवला जात नाही. तो बदलल्यास पुन्हा खात्री करावी लागेल.',
  'About you':
    'तुमच्याविषयी',
  'Year of birth':
    'जन्म वर्ष',
  'Other members see only your approximate age.':
    'इतर सदस्यांना फक्त तुमचे अंदाजे वय दिसते.',
  'Gender':
    'लिंग',
  'Woman':
    'स्त्री',
  'Man':
    'पुरुष',
  'Other':
    'इतर',
  'Smoking in the car':
    'गाडीत धूम्रपान',
  'Pets in the car':
    'गाडीत पाळीव प्राणी',
  'Music on the way':
    'प्रवासात संगीत',
  'Conversation':
    'गप्पा',
  'I prefer a quiet ride':
    'मला शांत प्रवास आवडतो',
  'Some conversation is nice':
    'थोड्या गप्पा बऱ्या वाटतात',
  'I like to talk':
    'मला गप्पा मारायला आवडते',
  'Saving…':
    'जतन होत आहे…',
  'Save profile':
    'प्रोफाइल जतन करा',
  'None given':
    'दिलेला नाही',
  'Not confirmed':
    'खात्री झालेली नाही',
  'Send me a code':
    'मला कोड पाठवा',
  '6-digit code':
    '6 अंकी कोड',
  'Confirm':
    'खात्री करा',
  'This project sends no real email or SMS. The code was only written to the simulated outbox, which an administrator can read.':
    'हा प्रकल्प खरा ईमेल किंवा SMS पाठवत नाही. कोड फक्त सिम्युलेटेड आउटबॉक्समध्ये लिहिला आहे, जो प्रशासक वाचू शकतो.',
  'The people the emergency button is meant to tell. Text messages are simulated in this project, so today they would NOT be messaged.':
    'आणीबाणीच्या बटणाने ज्यांना कळवायचे ते लोक. या प्रकल्पात SMS सिम्युलेटेड आहेत, त्यामुळे आज त्यांना संदेश जाणार नाही.',
  'You have no emergency contacts yet.':
    'तुमचे अजून कोणतेही आपत्कालीन संपर्क नाहीत.',
  'Remove {name}':
    '{name} यांना काढा',
  'Yes, remove':
    'होय, काढा',
  'You can have at most {n} emergency contacts.':
    'तुम्ही जास्तीत जास्त {n} आपत्कालीन संपर्क ठेवू शकता.',
  'Their name':
    'त्यांचे नाव',
  'Their phone number':
    'त्यांचा फोन नंबर',
  'Who they are to you (optional)':
    'तुमच्याशी त्यांचे नाते (ऐच्छिक)',
  'Add contact':
    'संपर्क जोडा',
  'Profile':
    'प्रोफाइल',
  'Email and phone':
    'ईमेल आणि फोन',
  'Phone':
    'फोन',
  'Emergency contacts':
    'आपत्कालीन संपर्क',
  'Simulated outbox':
    'सिम्युलेटेड आउटबॉक्स',
  'None of these was sent to anyone. The newest 50 are kept in memory and are lost when the server restarts.':
    'यांपैकी काहीही कोणालाही पाठवले गेले नाही. सर्वात नवीन 50 मेमरीत ठेवले जातात आणि सर्व्हर पुन्हा सुरू झाल्यावर नष्ट होतात.',
  'Nothing has been handed to the simulated sender.':
    'सिम्युलेटेड प्रेषकाकडे अजून काहीही दिलेले नाही.',
  'Members who pressed the emergency button, oldest first. Acknowledging one records that you have seen it and are acting on it.':
    'आणीबाणीचे बटण दाबलेले सदस्य, सर्वात जुने आधी. दखल घेतल्यास नोंद होते की तुम्ही ते पाहिले आहे आणि त्यावर कृती करत आहात.',
  'No emergency is waiting.':
    'कोणतीही आणीबाणी प्रलंबित नाही.',
  'Phone: {phone}':
    'फोन: {phone}',
  'No phone number on the account.':
    'खात्यावर फोन नंबर नाही.',
  'Position given: {lat}, {lon}':
    'दिलेले ठिकाण: {lat}, {lon}',
  'No position was given.':
    'ठिकाण दिलेले नाही.',
  'On ride {id}':
    'प्रवास {id} मध्ये',
  '{n} emergency contacts on file. They were NOT messaged: the sender is simulated.':
    '{n} आपत्कालीन संपर्क नोंदलेले आहेत. त्यांना संदेश पाठवला गेला नाही: प्रेषक सिम्युलेटेड आहे.',
  'A message was sent to {n} emergency contacts.':
    '{n} आपत्कालीन संपर्कांना संदेश पाठवला.',
  'Acknowledge':
    'दखल घ्या',
  // Search filters
  'Hide filters':
    'फिल्टर लपवा',
  'Filters':
    'फिल्टर',
  'Show only rides that':
    'फक्त असे प्रवास दाखवा जे',
  'Leave in the':
    'या वेळी निघतात',
  'Any time of day':
    'दिवसात कोणत्याही वेळी',
  'Morning, before 12':
    'सकाळी, 12 च्या आधी',
  'Afternoon, 12 to 5':
    'दुपारी, 12 ते 5',
  'Evening, from 5':
    'संध्याकाळी, 5 पासून',
  'Cost at most, per seat (₹)':
    'प्रति जागा कमाल किंमत (₹)',
  'Confirm instantly':
    'लगेच निश्चित होतात',
  'Have a driver with a confirmed email or phone':
    'ज्यांच्या चालकाचा ईमेल किंवा फोन खात्री केलेला आहे',
  'Have a driver who said no smoking':
    'ज्यांच्या चालकाने धूम्रपान नको सांगितले आहे',
  'Have a driver who said pets are welcome':
    'ज्यांच्या चालकाने पाळीव प्राणी चालतील सांगितले आहे',
  'The last two leave out drivers who have not said either way. Filters apply when you press Search.':
    'शेवटचे दोन फिल्टर काहीच न सांगितलेल्या चालकांना वगळतात. शोधा दाबल्यावर फिल्टर लागू होतात.',
  'No rides match on that day with those filters. Try fewer filters, another date or other points.':
    'त्या दिवशी या फिल्टरसह कोणताही प्रवास मिळाला नाही. कमी फिल्टर, दुसरी तारीख किंवा दुसरी ठिकाणे वापरून पहा.',
  'Contact confirmed':
    'संपर्काची खात्री झाली',
  // Ride notes, return and repeated rides
  'At most 500 characters':
    'जास्तीत जास्त 500 अक्षरे',
  'The return must leave after you have arrived':
    'परतीचा प्रवास तुम्ही पोहोचल्यानंतरच निघू शकतो',
  'I promise at most two passengers on the back seat':
    'मागच्या सीटवर जास्तीत जास्त दोन प्रवासी असतील असे मी वचन देतो/देते',
  'Notes for passengers (optional)':
    'प्रवाशांसाठी सूचना (ऐच्छिक)',
  'Luggage, where exactly you wait, anything they should know.':
    'सामान, तुम्ही नेमके कुठे थांबाल, त्यांना माहीत असावे असे काहीही.',
  'Return ride leaving at (optional)':
    'परतीच्या प्रवासाची वेळ (ऐच्छिक)',
  'The same stops in reverse, with the same prices and the same time between stops.':
    'तेच थांबे उलट क्रमाने, त्याच किमती आणि थांब्यांमधील तोच वेळ.',
  'Repeat every week':
    'दर आठवड्याला पुन्हा',
  'At the same time of day. Each is a separate ride you can withdraw on its own.':
    'दिवसाच्या त्याच वेळी. प्रत्येक स्वतंत्र प्रवास आहे, जो तुम्ही वेगळा मागे घेऊ शकता.',
  'No, just this once':
    'नाही, फक्त या वेळी',
  'For {n} more week':
    'आणखी {n} आठवड्यासाठी',
  'For {n} more weeks':
    'आणखी {n} आठवड्यांसाठी',
  'This will publish {n} rides.':
    'यामुळे {n} प्रवास प्रकाशित होतील.',
  'At most two in the back':
    'मागे जास्तीत जास्त दोन प्रवासी',
  'Promise at most two in the back':
    'मागे जास्तीत जास्त दोन प्रवाशांचे वचन देतात',
  'From the driver:':
    'चालकाकडून:',
  // Vehicle details
  'Basic':
    'साधी',
  'Comfortable':
    'आरामदायी',
  'Premium':
    'प्रीमियम',
  'No luggage':
    'सामान नाही',
  'A small bag each':
    'प्रत्येकी एक छोटी बॅग',
  'A medium bag each':
    'प्रत्येकी एक मध्यम बॅग',
  'A large suitcase each':
    'प्रत्येकी एक मोठी सुटकेस',
  'Electric':
    'इलेक्ट्रिक',
  'Between 1 and 300 kWh':
    '1 ते 300 kWh दरम्यान',
  'Between 5 and 60 kWh per 100 km':
    'दर 100 किमीला 5 ते 60 kWh दरम्यान',
  'About {km} km on a full charge, from the figures you gave. Not a measured range.':
    'तुम्ही दिलेल्या आकड्यांनुसार पूर्ण चार्जवर सुमारे {km} किमी. ही मोजलेली रेंज नाही.',
  'Comfort (optional)':
    'आरामाचा दर्जा (ऐच्छिक)',
  'Your own description. Nobody inspects the car.':
    'हे तुमचे स्वतःचे वर्णन आहे. गाडीची कोणी तपासणी करत नाही.',
  'Luggage per passenger (optional)':
    'प्रति प्रवासी सामान (ऐच्छिक)',
  'This vehicle is electric':
    'हे वाहन इलेक्ट्रिक आहे',
  'Battery (kWh, optional)':
    'बॅटरी (kWh, ऐच्छिक)',
  'Consumption (kWh per 100 km, optional)':
    'वापर (kWh दर 100 किमी, ऐच्छिक)',
  // Seat holds
  'Hold while I decide':
    'ठरवेपर्यंत राखून ठेवा',
  'Held for you until {time}. This is not a booking: book before then or the seats go back.':
    '{time} पर्यंत तुमच्यासाठी राखून ठेवल्या आहेत. हे बुकिंग नाही: त्याआधी बुक करा, नाहीतर जागा परत जातील.',
  // Passenger payments
  'Payments':
    'देयके',
  'Payments, newest first':
    'देयके, सर्वात नवीन आधी',
  'Booked':
    'बुकिंगची वेळ',
  // Women-only rides
  'Women passengers only':
    'फक्त महिला प्रवासी',
  'A ride for women passengers only can be offered by a driver whose profile says she is a woman.':
    'फक्त महिला प्रवाशांसाठीचा प्रवास तीच चालक देऊ शकते जिच्या प्रोफाइलमध्ये ती स्त्री असल्याचे लिहिले आहे.',
  'Women only':
    'फक्त महिला',
  'Are for women only':
    'फक्त महिलांसाठी आहेत',
  'Not shown on your profile. Choosing Woman lets you offer and book women-only rides; nobody checks it.':
    'तुमच्या प्रोफाइलवर दाखवले जात नाही. स्त्री निवडल्यास तुम्ही फक्त-महिला प्रवास देऊ आणि बुक करू शकता; याची कोणी तपासणी करत नाही.',
  // Travel passes
  '{n} days':
    '{n} दिवस',
  // Receipts
  'Download receipt (PDF, in English)':
    'पावती डाउनलोड करा (PDF, इंग्रजीत)',
  'The receipt could not be downloaded. Try again.':
    'पावती डाउनलोड होऊ शकली नाही. पुन्हा प्रयत्न करा.',
  'Receipt':
    'पावती',
  'View or print receipt':
    'पावती पाहा किंवा छापा',
  'Receipt for booking {id}':
    'बुकिंग {id} ची पावती',
  '{from} to {to}, {n} seat':
    '{from} ते {to}, {n} जागा',
  '{from} to {to}, {n} seats':
    '{from} ते {to}, {n} जागा',
  'Boarding':
    'बसण्याची वेळ',
  'Booking status':
    'बुकिंगची स्थिती',
  '{when}, by {method}':
    '{when}, {method} ने',
  'Fare':
    'भाडे',
  'This is not a tax invoice.':
    'हे कर बीजक (टॅक्स इनव्हॉइस) नाही.',
  'Times are India Standard Time.':
    'वेळा भारतीय प्रमाण वेळेनुसार (IST) आहेत.',
  'Print or save as PDF':
    'छापा किंवा PDF म्हणून जतन करा',
  'To keep a copy, choose to save as PDF instead of a printer.':
    'प्रत ठेवण्यासाठी, प्रिंटरऐवजी PDF म्हणून जतन करणे निवडा.',
  // Durability explanations
  'How far ahead it was booked':
    'किती आधी बुक केले',
  'Seats booked':
    'बुक केलेल्या जागा',
  'Hour the ride leaves':
    'प्रवास निघण्याची वेळ',
  'Gap from the time asked for':
    'हव्या असलेल्या वेळेपासूनचे अंतर',
  'Earlier accepted bookings':
    'आधी स्वीकारलेली बुकिंग',
  'Earlier cancellations':
    'आधीचे रद्दीकरण',
  'Earlier completed trips':
    'आधी पूर्ण केलेले प्रवास',
  'Earlier no-shows':
    'आधी न येणे',
  'Share of earlier bookings cancelled':
    'आधीच्या बुकिंगपैकी रद्द केलेला वाटा',
  'Main reasons':
    'मुख्य कारणे',
  '{factor} makes a cancellation likelier':
    '{factor} मुळे रद्द होण्याची शक्यता वाढते',
  '{factor} makes a cancellation less likely':
    '{factor} मुळे रद्द होण्याची शक्यता कमी होते',
  // Driver response rate
  'Answers requests':
    'विनंत्यांना उत्तर देतो',
  'Not enough requests yet':
    'अजून पुरेशा विनंत्या नाहीत',
  '{rate}, usually within {time}':
    '{rate}, सहसा {time} मध्ये',
  // Boarding codes
  'Reference {reference}. Boarding code':
    'संदर्भ {reference}. बोर्डिंग कोड',
  'Show the code to the driver when you board.':
    'बसताना हा कोड चालकाला दाखवा.',
  'Show my boarding code':
    'माझा बोर्डिंग कोड दाखवा',
  'Boarding code shown by the passenger':
    'प्रवाशाने दाखवलेला बोर्डिंग कोड',
  'Code':
    'कोड',
  'Check code':
    'कोड तपासा',
  'Matches this booking':
    'या बुकिंगशी जुळतो',
  'Does not match this booking':
    'या बुकिंगशी जुळत नाही',
  // After the trip
  'Thank you for confirming.':
    'खात्री केल्याबद्दल धन्यवाद.',
  'Thank you. An administrator will look into it; nothing has been changed yet.':
    'धन्यवाद. प्रशासक याची तपासणी करेल; अजून काहीही बदललेले नाही.',
  'The driver marked this trip completed. Did it happen?':
    'चालकाने हा प्रवास पूर्ण झाल्याचे नोंदवले आहे. तो झाला का?',
  'Yes, I travelled':
    'होय, मी प्रवास केला',
  'No, it did not happen':
    'नाही, तो झाला नाही',
  '{n} completed trips are disputed by their passenger.':
    '{n} पूर्ण प्रवासांवर त्यांच्या प्रवाशाने आक्षेप घेतला आहे.',
  'See them':
    'पहा',
  'Disputed trips':
    'विवादित प्रवास',
  'Trips a driver marked completed and the passenger says did not happen. Nothing has been reversed: payments are simulated, and each case is for a person to judge.':
    'चालकाने पूर्ण झाल्याचे नोंदवलेले आणि प्रवासी म्हणतो की झाले नाहीत असे प्रवास. काहीही उलटवलेले नाही: देयके सिम्युलेटेड आहेत, आणि प्रत्येक प्रकरणाचा निर्णय एखाद्या व्यक्तीने घ्यायचा आहे.',
  'No trip is disputed.':
    'कोणताही प्रवास विवादित नाही.',
  'driver':
    'चालक',
  'disputed {time}':
    '{time} रोजी आक्षेप',
  // More search filters
  'Cost at least, per seat (₹)':
    'प्रति जागा किमान किंमत (₹)',
  'Comfort at least':
    'किमान आराम',
  'Any':
    'कोणतेही',
  'Room for luggage, at least':
    'सामानासाठी किमान जागा',
  'Have a driver who likes music on the way':
    'ज्यांच्या चालकाला प्रवासात संगीत आवडते',
  'Have a driver who prefers a quiet ride':
    'ज्यांच्या चालकाला शांत प्रवास आवडतो',
  // Levels and the driver record
  'Newcomer':
    'नवखा',
  'Intermediate':
    'मध्यम',
  'Experienced':
    'अनुभवी',
  'Expert':
    'तज्ज्ञ',
  'Ambassador':
    'राजदूत',
  'Level':
    'स्तर',
  'My record':
    'माझी नोंद',
  'Rides completed':
    'पूर्ण केलेले प्रवास',
  'Rides you withdrew':
    'तुम्ही मागे घेतलेले प्रवास',
  'Passengers carried':
    'नेलेले प्रवासी',
  'Passengers whose booking you cancelled':
    'ज्यांचे बुकिंग तुम्ही रद्द केले ते प्रवासी',
  'Passengers you marked as not boarding':
    'तुम्ही न आलेले म्हणून नोंदवलेले प्रवासी',
  'Only you see this page. Passengers see your level, rating, completed trips and how you answer requests.':
    'हे पान फक्त तुम्ही पाहता. प्रवासी तुमचा स्तर, रेटिंग, पूर्ण प्रवास आणि विनंत्यांना उत्तर देणे पाहतात.',
  // Notification preferences
  'You always see notifications here. You can also have a copy sent to a confirmed email address or phone. In this project no email or SMS is really sent: copies go to the simulated outbox.':
    'तुम्ही सूचना नेहमी इथे पाहता. खात्री केलेल्या ईमेल पत्त्यावर किंवा फोनवर त्यांची प्रत मागवू शकता. या प्रकल्पात कोणताही ईमेल किंवा SMS खरोखर पाठवला जात नाही: प्रती सिम्युलेटेड आउटबॉक्समध्ये जातात.',
  'Email me a copy':
    'मला ईमेलवर प्रत पाठवा',
  'Text me a copy':
    'मला SMS वर प्रत पाठवा',
  'Confirm your email address above, or no copy can be sent.':
    'वर तुमच्या ईमेल पत्त्याची खात्री करा, नाहीतर प्रत पाठवता येणार नाही.',
  'Confirm your phone number above, or no copy can be sent.':
    'वर तुमच्या फोन नंबरची खात्री करा, नाहीतर प्रत पाठवता येणार नाही.',
  // Series and back-office browsing
  'Cancel every ride in this series':
    'या मालिकेतील सर्व प्रवास रद्द करा',
  'Yes, cancel them all':
    'होय, सर्व रद्द करा',
  'Rides':
    'प्रवास',
  'Bookings':
    'बुकिंग',
  'Status':
    'स्थिती',
  'No rides.':
    'कोणताही प्रवास नाही.',
  'No bookings.':
    'कोणतेही बुकिंग नाही.',
  '{n} seats offered, {b} bookings':
    '{n} जागा उपलब्ध, {b} बुकिंग',
  'with {driver}, {n} seats':
    '{driver} सोबत, {n} जागा',
  // Referral
  'Invitation code (optional)':
    'आमंत्रण कोड (ऐच्छिक)',
  'Invite friends':
    'मित्रांना आमंत्रित करा',
  'Your invitation code':
    'तुमचा आमंत्रण कोड',
  '{n} signed up with it; {q} of them have completed a trip.':
    'याने {n} जणांनी नोंदणी केली; त्यांपैकी {q} जणांनी प्रवास पूर्ण केला आहे.',
  // Bus services
  'Buses instead':
    'त्याऐवजी बसेस',
  'Listed by VAYORA staff, not by the bus operator. Check times and fares with the operator before you travel.':
    'VAYORA कर्मचाऱ्यांनी सूचीबद्ध केलेले, बस चालक कंपनीने नाही. प्रवासापूर्वी वेळ आणि भाडे चालक कंपनीकडे तपासा.',
  'about {hours} h':
    'सुमारे {hours} तास',
  'Bus services':
    'बस सेवा',
  'Passengers see these when no ride matches their search, and in the notice when a driver withdraws. Enter them from the operator\'s published timetable: nothing here checks them, and passengers are told to check with the operator.':
    'कोणतीही राइड शोधाशी जुळत नाही तेव्हा आणि चालक राइड मागे घेतो तेव्हा प्रवाशांना या दिसतात. त्या चालक कंपनीच्या प्रकाशित वेळापत्रकावरून नोंदवा: येथे त्यांची तपासणी होत नाही, आणि प्रवाशांना चालक कंपनीकडे तपासण्यास सांगितले जाते.',
  'Operator':
    'चालक कंपनी',
  'Leaves at':
    'सुटण्याची वेळ',
  'Journey time in minutes':
    'प्रवासाचा वेळ (मिनिटे)',
  'Fare in rupees':
    'भाडे (रुपये)',
  'Notes (optional)':
    'टीप (ऐच्छिक)',
  'Add bus service':
    'बस सेवा जोडा',
  'No bus services are listed.':
    'कोणतीही बस सेवा सूचीबद्ध नाही.',
  'Remove':
    'काढा',
  'Yes, remove it':
    'होय, काढा',
  // Electric range
  'This route is longer than the {range} km your vehicle covers on a full charge, by your own figures. Plan a charging stop: VAYORA does not plan one for you.':
    'हा मार्ग तुमच्याच आकड्यांनुसार पूर्ण चार्जवर तुमचे वाहन जाणाऱ्या {range} किमीपेक्षा लांब आहे. चार्जिंगसाठी थांब्याचे नियोजन करा: VAYORA तुमच्यासाठी ते नियोजन करत नाही.',
  // Phone sign-up
  'Enter your email or phone number':
    'तुमचा ईमेल किंवा फोन नंबर टाका',
  'Enter a valid email or phone number':
    'वैध ईमेल किंवा फोन नंबर टाका',
  'Email or phone number':
    'ईमेल किंवा फोन नंबर',
  'Sign in with':
    'कशाने साइन इन करणार',
  'You will be asked to confirm it with a code. In this project no SMS is really sent.':
    'तुम्हाला एका कोडने त्याची पुष्टी करण्यास सांगितले जाईल. या प्रकल्पात कोणताही SMS प्रत्यक्षात पाठवला जात नाही.',
  'Signed up by phone':
    'फोनने नोंदणी केली',
  // What-if explorer
  'What if':
    'काय झाले तर',
  'Question':
    'प्रश्न',
  'How many reconfirmation requests may go out at once':
    'एका वेळी किती पुनःपुष्टी विनंत्या पाठवता येतात',
  'How far from their chosen time passengers will travel':
    'प्रवासी आपल्या निवडलेल्या वेळेपासून किती दूर प्रवास करतील',
  'How early drivers publish their rides':
    'चालक आपल्या राइड किती आधी प्रकाशित करतात',
  'Requests per round':
    'प्रत्येक फेरीतील विनंत्या',
  'Hours either side of the chosen time':
    'निवडलेल्या वेळेच्या दोन्ही बाजूंचे तास',
  'Days ahead, at the least, that a ride is published':
    'राइड किमान किती दिवस आधी प्रकाशित होते',
  'Completed rides per 100 searches':
    'प्रत्येक 100 शोधांमागे पूर्ण झालेल्या राइड',
  'Late share of cancellations':
    'रद्दीकरणांपैकी उशिराचा वाटा',
  'Reconfirmation requests per accepted booking':
    'प्रत्येक स्वीकृत बुकिंगमागे पुनःपुष्टी विनंत्या',
  'Released seats refilled':
    'सोडलेल्या जागा पुन्हा भरल्या',
  'Refills by a passenger offered no other ride':
    'दुसरी राइड न मिळालेल्या प्रवाशाने भरलेल्या जागा',
  'Searches offered no ride':
    'ज्या शोधांत एकही राइड मिळाली नाही',
  '{variant} compared with {baseline}, {seeds} seeds each, paired by seed.':
    '{variant} ची तुलना {baseline} शी, प्रत्येकी {seeds} सीड, सीडनुसार जोडलेले.',
  'The baseline was run on the same changed world.':
    'आधाररेषा त्याच बदललेल्या जगावर चालवली.',
  'The baseline was run once, on the unchanged world.':
    'आधाररेषा एकदाच, न बदललेल्या जगावर चालवली.',
  'Measure':
    'माप',
  'Difference (95% interval)':
    'फरक (95% मध्यांतर)',
  'to':
    'ते',
  'no clear difference':
    'स्पष्ट फरक नाही',
  'Run {run}. Rebuilt and checked by scripts/reproduce.sh.':
    'रन {run}. scripts/reproduce.sh ने पुन्हा तयार करून तपासला.',
  // What-if: threshold sweep
  'How risky a booking must look before its passenger is asked':
    'प्रवाशाला विचारण्यापूर्वी बुकिंग किती धोकादायक दिसायला हवी',
  'Ask when the estimated chance of lasting to departure is below':
    'प्रस्थानापर्यंत टिकण्याची अंदाजित शक्यता यापेक्षा कमी असेल तेव्हा विचारा',
  // What-if: oracle sweep
  'The most asking could gain, by how readily passengers release':
    'विचारल्याने जास्तीत जास्त किती फायदा, प्रवासी किती सहज जागा सोडतात त्यानुसार',
  'Chance an asked passenger releases at once':
    'विचारलेल्या प्रवाशाने लगेच जागा सोडण्याची शक्यता',
  // Rest stops and chargers
  'Chargers are listed near this route below.':
    'या मार्गाजवळचे चार्जर खाली दिले आहेत.',
  'No charger is listed near this route.':
    'या मार्गाजवळ कोणताही चार्जर सूचीबद्ध नाही.',
  'Along this route':
    'या मार्गावर',
  'km {km}':
    'किमी {km}',
  'charger, {kw} kW':
    'चार्जर, {kw} kW',
  'charger':
    'चार्जर',
  'rest stop':
    'विश्रांती थांबा',
  '{km} km off the route':
    'मार्गापासून {km} किमी दूर',
  'a good place for a break':
    'विश्रांतीसाठी चांगली जागा',
  'Listed by VAYORA staff. Nothing checks that a stop is open or a charger works.':
    'VAYORA कर्मचाऱ्यांनी सूचीबद्ध केलेले. थांबा उघडा आहे किंवा चार्जर चालतो हे कोणीही तपासत नाही.',
  'Rest stops and chargers':
    'विश्रांती थांबे आणि चार्जर',
  'Drivers see these when they work out a route that passes near them. Nothing here checks that a stop is open or a charger works, and drivers are told so.':
    'जवळून जाणारा मार्ग चालक तयार करतात तेव्हा त्यांना हे दिसतात. थांबा उघडा आहे किंवा चार्जर चालतो हे येथे तपासले जात नाही, आणि चालकांना तसे सांगितले जाते.',
  'Kind':
    'प्रकार',
  'Rest stop':
    'विश्रांती थांबा',
  'Charger':
    'चार्जर',
  'Latitude':
    'अक्षांश',
  'Longitude':
    'रेखांश',
  'Power in kW (optional)':
    'क्षमता kW मध्ये (ऐच्छिक)',
  'Add':
    'जोडा',
  'No rest stops or chargers are listed.':
    'कोणतेही विश्रांती थांबे किंवा चार्जर सूचीबद्ध नाहीत.',
  // Notifications
  '{passenger} booked {seats}.':
    '{passenger} यांनी {seats} बुक केल्या.',
  '{passenger} asked for {seats}.':
    '{passenger} यांनी {seats} साठी विनंती केली.',
  'The driver accepted your booking for {seats}.':
    'चालकाने {seats} साठी तुमचे बुकिंग स्वीकारले.',
  '{passenger}\'s request for {seats} was closed because it was not answered in time.':
    '{passenger} यांची {seats} साठीची विनंती वेळेत उत्तर न दिल्याने बंद केली.',
  '{passenger} cancelled {seats}.':
    '{passenger} यांनी {seats} रद्द केल्या.',
  '{n} seat, {from} to {to}':
    '{n} जागा, {from} ते {to}',
  '{n} seats, {from} to {to}':
    '{n} जागा, {from} ते {to}',
  'Your trip from {from} to {to} is complete. You can rate your driver in My bookings.':
    '{from} ते {to} हा तुमचा प्रवास पूर्ण झाला. माझी बुकिंग मध्ये तुम्ही चालकाला रेटिंग देऊ शकता.',
  'No other ride with seats leaves near that time.':
    'त्या वेळेच्या आसपास जागा असलेली दुसरी राइड नाही.',
  'No other ride with seats leaves near that time. Buses listed by VAYORA staff (check with the operator before travelling): {buses}.':
    'त्या वेळेच्या आसपास जागा असलेली दुसरी राइड नाही. VAYORA कर्मचाऱ्यांनी सूचीबद्ध केलेल्या बसेस (प्रवासापूर्वी चालक कंपनीकडे तपासा): {buses}.',
  'Other rides that could take you: {rides}. Search again to book one.':
    'तुम्हाला नेऊ शकणाऱ्या इतर राइड: {rides}. बुक करण्यासाठी पुन्हा शोधा.',
  '{time} from {stop} with {driver}':
    '{time}, {stop} येथून, {driver} यांच्यासोबत',
  '{time} {operator}, Rs {fare}':
    '{time} {operator}, ₹ {fare}',
  'A passenger says a trip marked completed did not happen. See disputed trips.':
    'पूर्ण म्हणून नोंदवलेला प्रवास झालाच नाही असे एका प्रवाशाचे म्हणणे आहे. वादग्रस्त प्रवास पहा.',
  'How was your trip with {driver}? You can still rate it.':
    '{driver} यांच्यासोबतचा तुमचा प्रवास कसा झाला? तुम्ही अजूनही रेटिंग देऊ शकता.',
  'How was {passenger} as a passenger? You can still rate the trip.':
    'प्रवासी म्हणून {passenger} कसे होते? तुम्ही अजूनही प्रवासाला रेटिंग देऊ शकता.',
  'An administrator reviewed a report about you.':
    'एका प्रशासकाने तुमच्याबद्दलच्या तक्रारीचे पुनरावलोकन केले.',
  'An administrator reviewed a report about you: {note}':
    'एका प्रशासकाने तुमच्याबद्दलच्या तक्रारीचे पुनरावलोकन केले: {note}',
  '{name} pressed the emergency button. Open the emergency queue.':
    '{name} यांनी आपत्कालीन बटण दाबले. आपत्कालीन यादी उघडा.',
  // Photos
  'Choose a photo':
    'फोटो निवडा',
  'Uploading…':
    'अपलोड होत आहे…',
  'Replace photo':
    'फोटो बदला',
  'Add a photo':
    'फोटो जोडा',
  'Remove photo':
    'फोटो काढा',
  'JPEG or PNG, up to 5 MB. It is stored resized, without the location or other details the file may carry.':
    'JPEG किंवा PNG, जास्तीत जास्त 5 MB. ती लहान करून ठेवली जाते, फाइलमधील स्थान किंवा इतर तपशिलांशिवाय.',
  'Your photo':
    'तुमचा फोटो',
  'Photo of {name}':
    '{name} यांचा फोटो',
  'Photo of the {vehicle}':
    '{vehicle} चा फोटो',
  // Push
  'Notifications are blocked for this site in your browser settings.':
    'तुमच्या ब्राउझर सेटिंगमध्ये या साइटसाठी सूचना बंद आहेत.',
  'This browser cannot receive push notifications.':
    'हा ब्राउझर पुश सूचना घेऊ शकत नाही.',
  'Push notifications are not set up on this server.':
    'या सर्व्हरवर पुश सूचना सेट केलेल्या नाहीत.',
  'Push notifications are on in this browser.':
    'या ब्राउझरमध्ये पुश सूचना चालू आहेत.',
  'Push notifications are off in this browser.':
    'या ब्राउझरमध्ये पुश सूचना बंद आहेत.',
  'Turn off in this browser':
    'या ब्राउझरमध्ये बंद करा',
  'Turn on in this browser':
    'या ब्राउझरमध्ये चालू करा',
  'A push shows the notification in English, as email and SMS copies do.':
    'पुश सूचना इंग्रजीत दिसते, ईमेल आणि SMS प्रतींप्रमाणे.',
  // Driver record and walk
  'about {minutes} min walk to the pickup, in a straight line':
    'पिकअपपर्यंत सरळ रेषेत सुमारे {minutes} मिनिटे चालत',
  'No completed rides yet':
    'अजून एकही राइड पूर्ण केलेली नाही',
  'Completed {completed} of the {offered} rides they have finished or withdrawn':
    'पूर्ण केलेल्या किंवा मागे घेतलेल्या {offered} राइडपैकी {completed} पूर्ण केल्या',
  // Flexibility tiers
  'If the driver withdraws':
    'चालकाने राइड मागे घेतल्यास',
  'Only this ride: suggest others':
    'फक्त हीच राइड: इतर सुचवा',
  'Flexible: book me within 2 hours':
    'लवचिक: 2 तासांच्या आत बुक करा',
  'Any time that day':
    'त्या दिवशी केव्हाही',
  'This driver has withdrawn some rides. A flexible booking would move you to another ride automatically.':
    'या चालकाने काही राइड मागे घेतल्या आहेत. लवचिक बुकिंग तुम्हाला आपोआप दुसऱ्या राइडवर नेईल.',
  'Already on the road: it may reach {stop} before the time shown, so be there early.':
    'राइड आधीच रस्त्यावर आहे: ती दाखवलेल्या वेळेआधी {stop} ला पोहोचू शकते, म्हणून आधी पोहोचा.',
  'If the driver withdraws, you are booked on another ride within 2 hours.':
    'चालकाने राइड मागे घेतल्यास तुम्हाला 2 तासांच्या आत दुसऱ्या राइडवर बुक केले जाईल.',
  'If the driver withdraws, you are booked on another ride that day.':
    'चालकाने राइड मागे घेतल्यास तुम्हाला त्याच दिवशी दुसऱ्या राइडवर बुक केले जाईल.',
  'As you chose a flexible booking, you are booked on the {time} ride from {stop} with {driver}.':
    'तुम्ही लवचिक बुकिंग निवडली होती, म्हणून तुम्हाला {stop} येथून {time} च्या {driver} यांच्या राइडवर बुक केले आहे.',
  'As you chose a flexible booking, you have asked for a seat on the {time} ride from {stop} with {driver}. The driver will answer.':
    'तुम्ही लवचिक बुकिंग निवडली होती, म्हणून {stop} येथून {time} च्या {driver} यांच्या राइडवर तुमच्यासाठी जागेची विनंती केली आहे. चालक उत्तर देतील.',
  'You chose a flexible booking, but no other ride with seats fits it. Nothing new has been booked.':
    'तुम्ही लवचिक बुकिंग निवडली होती, पण जागा असलेली दुसरी कोणतीही राइड त्यात बसत नाही. नवीन काहीही बुक केलेले नाही.',
  // Server messages
  'A bus must go somewhere else':
    'बसने दुसऱ्या ठिकाणी जायला हवे',
  'A code was sent a moment ago. Wait before asking for another.':
    'आत्ताच एक कोड पाठवला आहे. दुसरा मागण्यापूर्वी थांबा.',
  'A no-show can only be recorded while the ride is in progress':
    'प्रवासी न आल्याची नोंद फक्त राइड सुरू असतानाच करता येते',
  'A ride needs exactly one price per leg between stops':
    'राइडमध्ये थांब्यांमधील प्रत्येक टप्प्याला नेमकी एक किंमत हवी',
  'Add a phone number first':
    'आधी फोन नंबर जोडा',
  'Administrators cannot self-register':
    'प्रशासक स्वतः नोंदणी करू शकत नाहीत',
  'Battery and consumption are only for an electric vehicle':
    'बॅटरी आणि वापर फक्त इलेक्ट्रिक वाहनासाठी आहेत',
  'Booking not found':
    'बुकिंग सापडले नाही',
  'Contact not found':
    'संपर्क सापडला नाही',
  'Departure time must be in the future':
    'सुटण्याची वेळ भविष्यातील असावी',
  'Email is already registered':
    'हा ईमेल आधीच नोंदणीकृत आहे',
  'Enter a phone number of 10 to 15 digits':
    '10 ते 15 अंकी फोन नंबर टाका',
  'Give an email address or a phone number':
    'ईमेल पत्ता किंवा फोन नंबर द्या',
  'Invalid email, phone number or password':
    'ईमेल, फोन नंबर किंवा पासवर्ड चुकीचा आहे',
  'It is too early to start this ride':
    'ही राइड सुरू करण्यासाठी अजून खूप लवकर आहे',
  'Member not found':
    'सदस्य सापडला नाही',
  'No boarding pass for that booking':
    'त्या बुकिंगचा बोर्डिंग पास नाही',
  'No open alert with that id':
    'त्या आयडीचा कोणताही उघडा अलर्ट नाही',
  'No photo':
    'फोटो नाही',
  'No receipt for that booking':
    'त्या बुकिंगची पावती नाही',
  'No ride open for booking has those stops':
    'बुकिंगसाठी उघड्या कोणत्याही राइडमध्ये हे थांबे नाहीत',
  'No such bus service':
    'अशी कोणतीही बस सेवा नाही',
  'No such channel':
    'असे कोणतेही माध्यम नाही',
  'No such stopover':
    'असा कोणताही थांबा नाही',
  'Not enough seats left on that part of the ride':
    'राइडच्या त्या भागावर पुरेशा जागा उरलेल्या नाहीत',
  'Not enough seats left on that part of the ride to hold':
    'राइडच्या त्या भागावर राखून ठेवण्यासाठी पुरेशा जागा उरलेल्या नाहीत',
  'Not enough seats left on that part of the ride: some are being held for another passenger for a few minutes':
    'राइडच्या त्या भागावर पुरेशा जागा उरलेल्या नाहीत: काही जागा दुसऱ्या प्रवाशासाठी काही मिनिटे राखून ठेवल्या आहेत',
  'Notification not found':
    'सूचना सापडली नाही',
  'Only a charger has a power rating':
    'फक्त चार्जरची क्षमता नोंदवली जाते',
  'Only a completed trip can be confirmed':
    'फक्त पूर्ण झालेल्या प्रवासाची पुष्टी करता येते',
  'Only a completed trip can be rated':
    'फक्त पूर्ण झालेल्या प्रवासाला रेटिंग देता येते',
  'Only a driver whose profile says she is a woman can offer a women-only ride. Set your gender on your account page first.':
    'प्रोफाइलवर महिला असल्याचे नमूद असलेली चालकच फक्त महिलांसाठीची राइड देऊ शकते. आधी तुमच्या खात्याच्या पानावर लिंग नोंदवा.',
  'Only a ride in progress can be completed':
    'फक्त सुरू असलेली राइडच पूर्ण करता येते',
  'Only a scheduled ride can be cancelled':
    'फक्त नियोजित राइडच रद्द करता येते',
  'Only a scheduled ride can be started':
    'फक्त नियोजित राइडच सुरू करता येते',
  'Phone number is already registered':
    'हा फोन नंबर आधीच नोंदणीकृत आहे',
  'Push notifications are not set up on this server':
    'या सर्व्हरवर पुश सूचना सेट केलेल्या नाहीत',
  'Report not found':
    'तक्रार सापडली नाही',
  'Request a code first':
    'आधी कोड मागवा',
  'Ride not found':
    'राइड सापडली नाही',
  'Seats cannot be held right now. You can still book.':
    'सध्या जागा राखून ठेवता येत नाहीत. तरीही तुम्ही बुक करू शकता.',
  'Stops must be in travel order with increasing offsetMinutes':
    'थांबे प्रवासाच्या क्रमाने आणि वाढत्या offsetMinutes सह असावेत',
  'That code has expired. Request a new one.':
    'त्या कोडची मुदत संपली आहे. नवीन कोड मागवा.',
  'That code is no longer valid. Request a new one.':
    'तो कोड आता वैध नाही. नवीन कोड मागवा.',
  'That code is not right':
    'तो कोड बरोबर नाही',
  'That is not a photo VAYORA can read: use a JPEG or PNG':
    'VAYORA हा फोटो वाचू शकत नाही: JPEG किंवा PNG वापरा',
  'That is not a push service VAYORA sends to':
    'VAYORA या पुश सेवेला पाठवत नाही',
  'That phone number belongs to another account':
    'तो फोन नंबर दुसऱ्या खात्याचा आहे',
  'That photo has too many pixels':
    'त्या फोटोमध्ये खूप जास्त पिक्सेल आहेत',
  'That photo is too large':
    'तो फोटो खूप मोठा आहे',
  'That referral code does not exist':
    'तो आमंत्रण कोड अस्तित्वात नाही',
  'The browser\'s keys are not valid':
    'ब्राउझरच्या की वैध नाहीत',
  'The earliest hour must be before the latest':
    'सर्वात लवकरचा तास सर्वात उशिराच्या तासाआधी असावा',
  'The email could not be sent. Try again later.':
    'ईमेल पाठवता आला नाही. नंतर पुन्हा प्रयत्न करा.',
  'The first stop must have offsetMinutes 0':
    'पहिल्या थांब्याचे offsetMinutes 0 असावे',
  'The lowest price must not be above the highest':
    'सर्वात कमी किंमत सर्वात जास्त किमतीपेक्षा जास्त नसावी',
  'The return must leave after the ride out has arrived':
    'परतीची राइड जाणारी राइड पोहोचल्यानंतरच निघायला हवी',
  'This account has no email address':
    'या खात्याला ईमेल पत्ता नाही',
  'This driver approves each request, and it is too close to departure for an answer. Choose a ride that confirms instantly.':
    'हा चालक प्रत्येक विनंती मंजूर करतो, आणि उत्तरासाठी सुटण्याची वेळ खूप जवळ आहे. लगेच पुष्टी होणारी राइड निवडा.',
  'This idempotency key was already used for a different booking':
    'ही idempotency key दुसऱ्या बुकिंगसाठी आधीच वापरली आहे',
  'This is already verified':
    'याची पुष्टी आधीच झाली आहे',
  'This report is already closed':
    'ही तक्रार आधीच बंद झाली आहे',
  'This request was already submitted':
    'ही विनंती आधीच पाठवली आहे',
  'This ride has already left that stop':
    'ही राइड त्या थांब्यावरून आधीच निघाली आहे',
  'This ride has already left; the booking can no longer be cancelled':
    'ही राइड निघाली आहे; बुकिंग आता रद्द करता येणार नाही',
  'This ride is for women only':
    'ही राइड फक्त महिलांसाठी आहे',
  'This ride is not open for booking':
    'ही राइड बुकिंगसाठी उघडी नाही',
  'This ride is not part of a series with rides still to run':
    'ही राइड अजून चालायच्या राइड असलेल्या मालिकेचा भाग नाही',
  'This ride is on the road and due at that stop too soon to book':
    'ही राइड रस्त्यावर आहे आणि त्या थांब्यावर इतक्या लवकर पोहोचेल की बुकिंग होऊ शकत नाही',
  'This ride is already on the road, and its driver approves each request':
    'ही राइड आधीच रस्त्यावर आहे, आणि तिचा चालक प्रत्येक विनंती मंजूर करतो',
  'That insurance has already ended':
    'तो विमा आधीच संपला आहे',
  'A call can only be made while the booking is confirmed':
    'बुकिंग निश्चित असतानाच कॉल करता येतो',
  'It is too early to call: calls open shortly before the trip':
    'कॉल करण्यासाठी अजून खूप लवकर आहे: प्रवासाच्या थोडे आधी कॉल सुरू होतात',
  'Confirm your phone number on your account page before calling':
    'कॉल करण्यापूर्वी तुमच्या खाते पानावर तुमचा फोन नंबर निश्चित करा',
  'They have no confirmed phone number. Use the chat instead.':
    'त्यांचा कोणताही निश्चित फोन नंबर नाही. त्याऐवजी चॅट वापरा.',
  "{name} tried to call you through VAYORA. Calls are simulated, so no call came through. Reply in the ride's chat.":
    '{name} यांनी VAYORA मार्फत तुम्हाला कॉल करण्याचा प्रयत्न केला. कॉल सिम्युलेटेड आहेत, त्यामुळे कोणताही कॉल आला नाही. राइडच्या चॅटमध्ये उत्तर द्या.',
  'Call the driver':
    'चालकाला कॉल करा',
  'Call {name}':
    '{name} यांना कॉल करा',
  "Calling is simulated. With a real phone service you would now be connected to {name} through a masked number, so neither of you sees the other's number. No call was placed, and {name} has been told you tried.":
    'कॉल सिम्युलेटेड आहे. खऱ्या फोन सेवेसह तुम्ही आता लपवलेल्या नंबरद्वारे {name} यांच्याशी जोडले गेले असता, त्यामुळे कोणालाही दुसऱ्याचा नंबर दिसत नाही. कोणताही कॉल केला गेला नाही, आणि तुम्ही प्रयत्न केल्याचे {name} यांना सांगितले आहे.',
  'Insurance: {insurer}, until {date}. As you declared it: VAYORA has not checked it with the insurer.':
    'विमा: {insurer}, {date} पर्यंत. तुम्ही सांगितल्याप्रमाणे: VAYORA ने विमा कंपनीकडे याची तपासणी केलेली नाही.',
  'Remove the insurance':
    'विमा काढा',
  'Insurance':
    'विमा',
  'Insurer':
    'विमा कंपनी',
  'Insured until':
    'विमा कधीपर्यंत',
  'Declare insurance':
    'विमा नोंदवा',
  'Passengers see the insurer and the date, marked as not checked. No policy number is asked for.':
    "प्रवाशांना विमा कंपनी आणि तारीख दिसते, 'तपासलेले नाही' अशा खुणेसह. कोणताही पॉलिसी नंबर विचारला जात नाही.",
  'Insurance declared by the driver: {insurer}, until {date}. Not checked.':
    'चालकाने नोंदवलेला विमा: {insurer}, {date} पर्यंत. तपासलेले नाही.',
  'Best match for both of you':
    'तुम्हा दोघांसाठी सर्वोत्तम जुळणी',
  'Match {score} of 100':
    '100 पैकी {score} जुळणी',
  "Scored for both of you from what you each said on your profiles, the distance, the price and the driver's record of rides kept. Never from any prediction about either of you. Say what you prefer on your account page to be matched on it.":
    'तुम्हा दोघांसाठी गुण यावरून: तुम्ही प्रोफाइलवर काय सांगितले, अंतर, किंमत आणि चालकाचा पूर्ण केलेल्या राइडचा रेकॉर्ड. तुमच्यापैकी कोणाबद्दलच्या अंदाजावरून कधीच नाही. त्यावर जुळणीसाठी तुमच्या खाते पानावर तुमची पसंती सांगा.',
  'Pickup and drop-off close to you':
    'पिकअप आणि ड्रॉप-ऑफ तुमच्या जवळ',
  'The lowest price here':
    'येथील सर्वात कमी किंमत',
  'You agree about smoking':
    'धूम्रपानाबद्दल तुमचे एकमत आहे',
  'You differ about smoking':
    'धूम्रपानाबद्दल तुमचे मत वेगळे आहे',
  'You agree about pets':
    'पाळीव प्राण्यांबद्दल तुमचे एकमत आहे',
  'You differ about pets':
    'पाळीव प्राण्यांबद्दल तुमचे मत वेगळे आहे',
  'You agree about music':
    'संगीताबद्दल तुमचे एकमत आहे',
  'You differ about music':
    'संगीताबद्दल तुमचे मत वेगळे आहे',
  'You like the same amount of conversation':
    'तुम्हा दोघांना सारख्याच प्रमाणात गप्पा आवडतात',
  'One of you wants a quiet ride, the other likes to talk':
    'तुमच्यापैकी एकाला शांत प्रवास हवा आहे, दुसऱ्याला गप्पा आवडतात',
  'Minutes you will go out of your way, in all, to pick passengers up at their own point':
    'प्रवाशांना त्यांच्या स्वतःच्या ठिकाणाहून घेण्यासाठी तुम्ही एकूण किती मिनिटे मार्गापासून दूर जाल',
  '0 for none: passengers then board only at your stops. Each pickup is worked out before it is offered.':
    'काहीही नाही यासाठी 0: मग प्रवासी फक्त तुमच्या थांब्यांवर चढतात. प्रत्येक पिकअप देऊ करण्यापूर्वी काढले जाते.',
  'Enter whole minutes':
    'पूर्ण मिनिटे लिहा',
  'Enter 0 or more':
    '0 किंवा अधिक लिहा',
  'At most 30 minutes':
    'जास्तीत जास्त 30 मिनिटे',
  'The driver picks you up at your start, about {time}: {n} min out of their way.':
    'चालक तुम्हाला तुमच्या सुरुवातीच्या ठिकाणाहून सुमारे {time} ला घेतो: त्यांच्या मार्गापासून {n} मिनिटे दूर.',
  'Picked up at your own point after {stop}, not at the stop.':
    '{stop} नंतर तुमच्या स्वतःच्या ठिकाणाहून घेतले जाईल, थांब्यावरून नाही.',
  'You offered up to {n} min in all to pick passengers up at their own point':
    'प्रवाशांना त्यांच्या स्वतःच्या ठिकाणाहून घेण्यासाठी तुम्ही एकूण {n} मिनिटांपर्यंत देऊ केले',
  'Picks up at their own point after {stop}: {n} min out of your way.':
    '{stop} नंतर त्यांच्या स्वतःच्या ठिकाणाहून घ्यायचे: तुमच्या मार्गापासून {n} मिनिटे दूर.',
  'See the point on a map':
    'ठिकाण नकाशावर पहा',
  'That is more detour than a ride may offer':
    'एखादी राइड देऊ शकते त्यापेक्षा हा जास्त वळसा आहे',
  'This ride picks up only at its stops':
    'ही राइड फक्त तिच्या थांब्यांवरून प्रवासी घेते',
  'That pickup would take the driver further out of their way than they offered':
    'त्या पिकअपसाठी चालकाला देऊ केल्यापेक्षा जास्त मार्गापासून दूर जावे लागेल',
  'How many passengers choose to be rebooked if their driver withdraws':
    'चालकाने राइड मागे घेतल्यास किती प्रवासी पुन्हा बुक होणे निवडतात',
  'Share of passengers with a flexible booking':
    'लवचिक बुकिंग असलेल्या प्रवाशांचा वाटा',
  'about {minutes} min walk to the pickup, by footpath':
    'पिकअपपर्यंत पायवाटेने सुमारे {minutes} मिनिटे चालत',
  'You are picked up here':
    'तुम्हाला इथून घेतले जाईल',
  'You are picked up at your own point, about {time}.':
    'तुम्हाला तुमच्या स्वतःच्या ठिकाणाहून सुमारे {time} ला घेतले जाईल.',
  'As you chose a flexible booking, you are booked on the {time} ride with {driver}, who will pick you up at your own point.':
    'तुम्ही लवचिक बुकिंग निवडली होती, म्हणून तुम्हाला {driver} यांच्या {time} वाजताच्या राइडवर बुक केले आहे, जे तुम्हाला तुमच्या स्वतःच्या ठिकाणाहून घेतील.',
  'As you chose a flexible booking, you have asked for a seat on the {time} ride with {driver}, who would pick you up at your own point. The driver will answer.':
    'तुम्ही लवचिक बुकिंग निवडली होती, म्हणून तुम्ही {driver} यांच्या {time} वाजताच्या राइडमध्ये जागा मागितली आहे, जे तुम्हाला तुमच्या स्वतःच्या ठिकाणाहून घेतील. चालक उत्तर देतील.',
  '{time} with {driver}, picking you up at your own point':
    '{time} वाजता {driver} यांच्यासोबत, तुमच्या स्वतःच्या ठिकाणाहून घेऊन',
  'A stretch between two stops is longer than your vehicle covers on a full charge, by your own figures. Add a stop where you can charge.':
    'दोन थांब्यांमधील एक टप्पा तुमच्याच आकड्यांनुसार पूर्ण चार्जवर तुमचे वाहन जाणाऱ्या अंतरापेक्षा लांब आहे. जिथे चार्ज करता येईल असा थांबा जोडा.',
  '{from} to {to} is {km} km, longer than the {range} km your vehicle covers on a full charge, by your own figures. A ride with a stretch that long cannot be published: add a stop between them where you can charge.':
    '{from} ते {to} हे अंतर {km} किमी आहे, तुमच्याच आकड्यांनुसार पूर्ण चार्जवर तुमचे वाहन जाणाऱ्या {range} किमीपेक्षा लांब. इतका लांब टप्पा असलेली राइड प्रकाशित करता येत नाही: त्यांच्यामध्ये जिथे चार्ज करता येईल असा थांबा जोडा.',
  'Only a driver can declare an identity document':
    'फक्त चालकच ओळखपत्र जाहीर करू शकतात',
  'Aadhaar':
    'आधार',
  'PAN card':
    'पॅन कार्ड',
  'Driving licence':
    'वाहन चालक परवाना',
  'Passport':
    'पासपोर्ट',
  'Voter ID':
    'मतदार ओळखपत्र',
  'Identity document':
    'ओळखपत्र',
  'Declare':
    'जाहीर करा',
  'You have declared: {document}.':
    'तुम्ही जाहीर केले आहे: {document}.',
  'Declared: {document}, not checked':
    'त्यांच्याकडे {document} असल्याचे ते सांगतात, तपासलेले नाही',
  'You can say which identity document you hold. VAYORA never asks for its number or keeps a copy. Your profile says it was declared and not checked, until VAYORA staff have seen it.':
    'तुमच्याकडे कोणते ओळखपत्र आहे ते तुम्ही सांगू शकता. VAYORA त्याचा क्रमांक कधीही मागत नाही किंवा प्रत ठेवत नाही. VAYORA कर्मचाऱ्यांनी ते पाहीपर्यंत तुमच्या प्रोफाइलवर ते जाहीर केलेले आहे, तपासलेले नाही, असे दिसते.',
  'Sign in first':
    'आधी साइन इन करा',
  'Your session has ended. Sign in again.':
    'तुमचे सत्र संपले आहे. पुन्हा साइन इन करा.',
  'Only an administrator can run the simulator':
    'फक्त प्रशासकच सिम्युलेटर चालवू शकतात',
  'Live runs are not set up on this server':
    'या सर्व्हरवर आत्ताचे रन सेट केलेले नाहीत',
  'No such sweep can be run live':
    'असा कोणताही स्वीप आत्ता चालवता येत नाही',
  'You can have at most {n} emergency contacts':
    'तुम्ही जास्तीत जास्त {n} आपत्कालीन संपर्क ठेवू शकता',
  'This vehicle can offer at most {n} seats':
    'हे वाहन जास्तीत जास्त {n} जागा देऊ शकते',
  'A ride can repeat for at most {n} further weeks':
    'एखादी राइड जास्तीत जास्त आणखी {n} आठवडे पुन्हा होऊ शकते',
  'A {status} booking cannot become {next}':
    '{status} बुकिंग {next} होऊ शकत नाही',
  'Idempotency-Key must be 1 to {n} characters':
    'Idempotency-Key 1 ते {n} अक्षरांचा असावा',
  'pending':
    'प्रलंबित',
  'confirmed':
    'निश्चित',
  'declined':
    'नाकारलेली',
  'cancelled':
    'रद्द',
  'completed':
    'पूर्ण',
  'no-show':
    'गैरहजर',
  'Simulator runs on synthetic data, not real passengers. Changing a setting shows another saved run, and only the settings a sweep was run at can be chosen there. Any other value can be simulated below, as an exploration.':
    'कृत्रिम डेटावर सिम्युलेटरचे रन, खऱ्या प्रवाशांवर नाही. सेटिंग बदलल्यावर दुसरा जतन केलेला रन दिसतो, आणि तिथे ज्या सेटिंगवर स्वीप चालवला होता त्याच निवडता येतात. इतर कोणतेही मूल्य खाली शोध म्हणून सिम्युलेट करता येते.',
  'Simulate another value now':
    'आता दुसरे मूल्य सिम्युलेट करा',
  'Runs the simulator now, at a value no sweep was run at. Exploratory: means and the mean difference only, with no interval; kept nowhere, and never a report figure. About a second for every two seeds.':
    'सिम्युलेटर आता अशा मूल्यावर चालवतो ज्यावर कोणताही स्वीप चालवला नव्हता. फक्त शोधासाठी: फक्त सरासरी आणि सरासरी फरक, मध्यांतराशिवाय; कुठेही जतन होत नाही, आणि कधीही अहवालातील आकडा नाही. दर दोन सीडसाठी सुमारे एक सेकंद.',
  'This question cannot be simulated live.':
    'हा प्रश्न आत्ता सिम्युलेट करता येत नाही.',
  'from {min} to {max}':
    '{min} ते {max}',
  'Value to simulate':
    'सिम्युलेट करायचे मूल्य',
  'Seeds':
    'सीड',
  'Simulating…':
    'सिम्युलेट होत आहे…',
  'Simulate':
    'सिम्युलेट करा',
  'Live result':
    'आत्ताचा निकाल',
  'Difference':
    'फरक',
  'Seeds up / down':
    'सीड वर / खाली',
  '{variant} compared with {baseline} at {value}, on {seeds} seeds, simulated just now. Exploratory: no interval, and not a report figure.':
    '{value} वर {variant} ची {baseline} शी तुलना, {seeds} सीडवर, आत्ताच सिम्युलेट केलेली. फक्त शोधासाठी: मध्यांतर नाही, आणि अहवालातील आकडा नाही.',
  'Or about {minutes} min by auto-rickshaw to the pickup; no meter fare is known there':
    'किंवा रिक्षाने पिकअपपर्यंत सुमारे {minutes} मिनिटे; तिथले मीटर भाडे माहीत नाही',
  'Or about {minutes} min by auto-rickshaw from the drop-off; no meter fare is known there':
    'किंवा ड्रॉपपासून रिक्षाने सुमारे {minutes} मिनिटे; तिथले मीटर भाडे माहीत नाही',
  'Or about {minutes} min by auto-rickshaw to the pickup, about {fare} by the {town} meter fare':
    'किंवा रिक्षाने पिकअपपर्यंत सुमारे {minutes} मिनिटे, {town} च्या मीटर भाड्याने सुमारे {fare}',
  'Or about {minutes} min by auto-rickshaw from the drop-off, about {fare} by the {town} meter fare':
    'किंवा ड्रॉपपासून रिक्षाने सुमारे {minutes} मिनिटे, {town} च्या मीटर भाड्याने सुमारे {fare}',
  'roughly: in a straight line':
    'ढोबळमानाने: सरळ रेषेत',
  'An estimate: the meter, traffic and hour decide. Fare published by {source}, in force from {date}.':
    'अंदाज: खरे भाडे मीटर, वाहतूक आणि वेळ ठरवतात. भाडे {source} यांनी प्रकाशित केलेले, {date} पासून लागू.',
  'The text message could not be sent. Try again later.':
    'मजकूर संदेश पाठवता आला नाही. नंतर पुन्हा प्रयत्न करा.',
  '{n} of your emergency contacts could not be messaged. Call them yourself, or call 112.':
    'तुमच्या {n} आपत्कालीन संपर्कांना संदेश पाठवता आला नाही. त्यांना स्वतः फोन करा, किंवा 112 वर कॉल करा.',
  '{n} emergency contacts could not be messaged.':
    '{n} आपत्कालीन संपर्कांना संदेश पाठवता आला नाही.',
  "{name} is calling you through VAYORA, from the platform's number. Neither of you sees the other's number.":
    '{name} VAYORA मधून, प्लॅटफॉर्मच्या नंबरवरून तुम्हाला कॉल करत आहेत. तुमच्यापैकी कोणीही दुसऱ्याचा नंबर पाहत नाही.',
  "The call could not be placed. Try again, or use the ride's chat.":
    'कॉल लागू शकला नाही. पुन्हा प्रयत्न करा, किंवा राइडची चॅट वापरा.',
  "Your phone will ring now from VAYORA's number. Answer it to be connected to {name}: neither of you sees the other's number.":
    'आता तुमचा फोन VAYORA च्या नंबरवरून वाजेल. {name} यांच्याशी जोडले जाण्यासाठी उचला: तुमच्यापैकी कोणीही दुसऱ्याचा नंबर पाहत नाही.',
  'Those stops are not on this ride':
    'हे थांबे या राइडवर नाहीत',
  'Too many wrong attempts. Request a new code.':
    'खूप चुकीचे प्रयत्न झाले. नवीन कोड मागवा.',
  'That is as many codes as one day allows. Try again tomorrow.':
    'एका दिवसात एवढेच कोड मिळू शकतात. उद्या पुन्हा प्रयत्न करा.',
  'Too many wrong passwords. Try again in {n} min.':
    'खूप चुकीचे पासवर्ड झाले. {n} मिनिटांनी पुन्हा प्रयत्न करा.',
  'User not found':
    'वापरकर्ता सापडला नाही',
  'Vehicle not found':
    'वाहन सापडले नाही',
  'Vehicle not found among your vehicles':
    'तुमच्या वाहनांमध्ये हे वाहन सापडले नाही',
  'You already have an open report about this member':
    'या सदस्याबद्दल तुमची एक तक्रार आधीच उघडी आहे',
  'You can only report someone you have booked or driven with':
    'ज्यांच्यासोबत तुम्ही बुकिंग किंवा प्रवास केला आहे त्यांचीच तक्रार करता येते',
  'You cannot report yourself':
    'तुम्ही स्वतःची तक्रार करू शकत नाही',
  'You have already answered for this trip':
    'या प्रवासासाठी तुम्ही आधीच उत्तर दिले आहे',
  'You have already rated this trip':
    'तुम्ही या प्रवासाला आधीच रेटिंग दिले आहे',
  'You sign in with your phone number, so it cannot be removed':
    'तुम्ही फोन नंबरने साइन इन करता, म्हणून तो काढता येणार नाही',
  'toSeq must come after fromSeq':
    'toSeq हे fromSeq नंतर यायला हवे',
  'This account is suspended':
    'हे खाते निलंबित आहे',
  'Invalid request content.':
    'विनंतीतील मजकूर अवैध आहे.',
  'Cannot reach the server. Check your connection and try again.':
    'सर्व्हरपर्यंत पोहोचता येत नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.',
  // Unmet demand
  'Passengers looked for a ride from {from} to {to} on {date} and found none. If you are driving then, you could offer seats.':
    'प्रवाशांनी {date} रोजी {from} ते {to} राइड शोधली आणि एकही मिळाली नाही. तुम्ही तेव्हा जात असाल तर जागा देऊ शकता.',
  'Unmet demand':
    'अपूर्ण मागणी',
  'Days in the coming week where at least three searches on one stretch found no ride. Each morning, a few drivers who have driven the stretch are told, none more than once a week. Whether they then offer a ride is recorded, not reported as a result.':
    'येत्या आठवड्यातील असे दिवस जेव्हा एकाच टप्प्यावरील किमान तीन शोधांत एकही राइड मिळाली नाही. दररोज सकाळी, त्या टप्प्यावर चाललेल्या काही चालकांना कळवले जाते, कोणालाही आठवड्यातून एकदापेक्षा जास्त नाही. ते नंतर राइड देतात का हे नोंदवले जाते, निष्कर्ष म्हणून सांगितले जात नाही.',
  'No gaps in the coming week.':
    'येत्या आठवड्यात कोणतीही कमतरता नाही.',
  'Stretch':
    'टप्पा',
  'Searches with no ride':
    'राइड न मिळालेले शोध',
  'Drivers told':
    'कळवलेले चालक',
  // Google sign-in
  'Google sign-in could not be loaded. Use your email or phone instead.':
    'Google साइन-इन लोड होऊ शकले नाही. त्याऐवजी तुमचा ईमेल किंवा फोन वापरा.',
  'or':
    'किंवा',
  'No VAYORA account uses this Google address yet. How will you use VAYORA?':
    'या Google पत्त्याचे अजून कोणतेही VAYORA खाते नाही. तुम्ही VAYORA कसे वापराल?',
  'Google sign-in is not set up on this server':
    'या सर्व्हरवर Google साइन-इन सेट केलेले नाही',
  'That Google sign-in could not be checked':
    'त्या Google साइन-इनची तपासणी होऊ शकली नाही',
  'Google has not confirmed this email address':
    'Google ने या ईमेल पत्त्याची पुष्टी केलेली नाही',
  'No account uses this Google address yet. Choose passenger or driver to create one.':
    'या Google पत्त्याचे अजून कोणतेही खाते नाही. खाते तयार करण्यासाठी प्रवासी किंवा चालक निवडा.',
  // Front page
  'Book a seat in a car already making the trip, or fill the empty seats in yours. If your plans change, VAYORA reminds you to give the seat back while someone else can still take it.':
    'आधीच हा प्रवास करणाऱ्या कारमध्ये सीट बुक करा, किंवा तुमच्या कारमधील रिकाम्या सीट भरा. तुमचे बेत बदलले, तर दुसरे कोणी ती सीट घेऊ शकेल तोपर्यंत VAYORA तुम्हाला ती परत देण्याची आठवण करून देते.',
  'Offer a ride':
    'प्रवास द्या',
  'An emergency button on every trip':
    'प्रत्येक प्रवासात आपत्कालीन बटण',
  'days ahead you can book':
    'दिवस आधीपर्यंत बुक करता येते',
  'languages':
    'भाषा',
  'How it works':
    'हे कसे चालते',
  'Choose where you start and where you are going, or a point on the map. Rides passing within reach are shown with the walk to where you board.':
    'तुम्ही कुठून सुरू करता आणि कुठे जाता ते निवडा, किंवा नकाशावरील एखादे ठिकाण. आवाक्यातून जाणारे प्रवास, बसण्याच्या ठिकाणापर्यंतच्या चालण्यासह दाखवले जातात.',
  'Book a seat':
    'सीट बुक करा',
  'Travel together':
    'एकत्र प्रवास करा',
  'Chat with your driver and follow the car on the map. The emergency button puts calling 112 first.':
    'तुमच्या चालकाशी चॅट करा आणि नकाशावर कार पाहा. आपत्कालीन बटण 112 वर कॉल करणे सर्वात आधी ठेवते.',
  'Why giving a seat back early matters':
    'सीट लवकर परत देणे का महत्त्वाचे आहे',
  'A seat given back three days before departure can still be booked by someone else. Given back two hours before, it usually travels empty. So VAYORA asks early, asks for less of the fare the earlier you cancel, and never cancels anyone on a guess.':
    'सुटण्याच्या तीन दिवस आधी परत दिलेली सीट दुसरे कोणी अजूनही बुक करू शकते. दोन तास आधी परत दिलेली सीट बहुतेक रिकामीच जाते. म्हणून VAYORA लवकर विचारते, जितक्या लवकर रद्द कराल तितके कमी भाडे मागते, आणि अंदाजावरून कधीही कोणाचे बुकिंग रद्द करत नाही.',
  'The project measures what counts: rides completed for every 100 searches, not bookings made.':
    'प्रकल्प महत्त्वाचे तेच मोजतो: दर 100 शोधांमागे पूर्ण झालेले प्रवास, केलेली बुकिंग नव्हे.',
  'Days before: someone else can book it':
    'दिवस आधी: दुसरे कोणी ती बुक करू शकते',
  'Hours before: the seat is usually lost':
    'तास आधी: सीट बहुतेक रिकामीच जाते',
  'Pickups on the way':
    'वाटेत पिकअप',
  'A driver can take a few minutes out of the way to pick you up where the road passes.':
    'रस्ता जिथून जातो तिथून तुम्हाला घेण्यासाठी चालक काही मिनिटे वाट वाकडी करू शकतो.',
  'Women-only rides':
    'फक्त महिलांसाठी प्रवास',
  'A driver can offer a ride to women only; only women see it or can book it.':
    'चालक एखादा प्रवास फक्त महिलांसाठी देऊ शकतो; तो फक्त महिलाच पाहू आणि बुक करू शकतात.',
  'Flexible bookings':
    'लवचिक बुकिंग',
  'Choose a window of time. If your driver withdraws, VAYORA looks for another ride in it, at the same price.':
    'वेळेची एक मर्यादा निवडा. तुमच्या चालकाने प्रवास मागे घेतला, तर VAYORA त्याच मर्यादेत, त्याच किमतीत दुसरा प्रवास शोधते.',
  'Electric cars':
    'इलेक्ट्रिक कार',
  'A route an electric car cannot cover on one charge is caught before it is published, with chargers along the way.':
    'इलेक्ट्रिक कार एका चार्जमध्ये पूर्ण करू शकत नाही असा मार्ग प्रकाशित होण्याआधीच ओळखला जातो, वाटेतील चार्जरसह.',
  'Buses when no car goes':
    'कार नसेल तेव्हा बस',
  'When no ride fits, buses on the same stretch are suggested.':
    'कोणताही प्रवास जुळत नसेल, तेव्हा त्याच टप्प्यावरच्या बस सुचवल्या जातात.',
  'Three languages':
    'तीन भाषा',
  'Every screen in English, Hindi and Marathi, receipts included.':
    'प्रत्येक स्क्रीन इंग्रजी, हिंदी आणि मराठीत, पावत्यांसह.',
  'For passengers':
    'प्रवाशांसाठी',
  'Pay only for the stretch you ride':
    'फक्त तुम्ही प्रवास करता त्या टप्प्याचे पैसे भरा',
  "Each driver's record of rides kept, and their ratings":
    'प्रत्येक चालकाची पाळलेल्या प्रवासांची नोंद, आणि त्यांचे रेटिंग',
  'Create a passenger account':
    'प्रवासी खाते तयार करा',
  'For drivers':
    'चालकांसाठी',
  'Publish once, or repeat a ride every week':
    'एकदा प्रकाशित करा, किंवा दर आठवड्याला प्रवास पुन्हा करा',
  'Approve each passenger, or let them book at once':
    'प्रत्येक प्रवाशाला मंजुरी द्या, किंवा त्यांना लगेच बुक करू द्या',
  'Create a driver account':
    'चालक खाते तयार करा',
  // Paying after the ride
  'Cash to the driver':
    'चालकाला रोख',
  'Pay after the ride':
    'प्रवासानंतर पेमेंट',
  'nothing owed':
    'काहीही देय नाही',
  'pay after the ride':
    'प्रवासानंतर पेमेंट',
  'Owes nothing':
    'काहीही देय नाही',
  'Pays after the ride':
    'प्रवासानंतर पैसे देतील',
  'Yes, I was paid {amount} in cash':
    'हो, मला {amount} रोख मिळाले',
  'Nothing owed':
    'काहीही देय नाही',
  'Nothing is due on this booking':
    'या बुकिंगवर काहीही देय नाही',
  'Your driver recorded Rs {amount} paid in cash for {seats}.':
    'तुमच्या चालकाने {seats} साठी Rs {amount} रोख मिळाल्याची नोंद केली.',
  // Any route in India
  'Choose a place':
    'ठिकाण निवडा',
  'Choose a different place from where you start':
    'सुरुवातीच्या ठिकाणापेक्षा वेगळे ठिकाण निवडा',
  'Choose a different place from the stop before':
    'आधीच्या थांब्यापेक्षा वेगळे ठिकाण निवडा',
  'Minutes from {start} to {town}':
    '{start} पासून {town} पर्यंत मिनिटे',
  'Stop on the way {n}':
    'वाटेतील थांबा {n}',
  'Add a stop on the way':
    'वाटेत एक थांबा जोडा',
  'Remove this stop':
    'हा थांबा काढा',
  'Map around your start and destination. Click to choose an exact point.':
    'तुमच्या सुरुवातीच्या ठिकाणाभोवतीचा आणि गंतव्यस्थानाभोवतीचा नकाशा. अचूक ठिकाण निवडण्यासाठी क्लिक करा.',
  'Share the road between cities across India':
    'संपूर्ण भारतात शहरांदरम्यानचा प्रवास वाटून घ्या',
  'Any route in India':
    'भारतातील कोणताही मार्ग',
  'cities to choose from':
    'निवडण्यासाठी शहरे',
  'Search your route':
    'तुमचा मार्ग शोधा',
  'Made for travelling between cities':
    'शहरांदरम्यान प्रवासासाठी बनवलेले',
  'Road distances and times are worked out between Kolhapur and Pune. On other routes they are a straight-line estimate, and say so.':
    'रस्त्याचे अंतर आणि वेळ कोल्हापूर आणि पुणे दरम्यान काढले जातात. इतर मार्गांवर ते सरळ रेषेचा अंदाज असतात, आणि तसे सांगितले जाते.',
  'The research behind VAYORA was run on the Kolhapur to Pune route.':
    'VAYORA मागील संशोधन कोल्हापूर ते पुणे मार्गावर केले गेले.',
  'VAYORA, shared rides between cities':
    'VAYORA, शहरांदरम्यान सामायिक प्रवास',
  // Places in India
  'Maharashtra': 'महाराष्ट्र',
  'Andhra Pradesh': 'आंध्र प्रदेश',
  'Arunachal Pradesh': 'अरुणाचल प्रदेश',
  'Assam': 'आसाम',
  'Bihar': 'बिहार',
  'Chandigarh': 'चंदीगड',
  'Chhattisgarh': 'छत्तीसगड',
  'Dadra and Nagar Haveli and Daman and Diu': 'दादरा आणि नगर हवेली आणि दमण आणि दीव',
  'Delhi': 'दिल्ली',
  'Goa': 'गोवा',
  'Gujarat': 'गुजरात',
  'Haryana': 'हरियाणा',
  'Himachal Pradesh': 'हिमाचल प्रदेश',
  'Jammu and Kashmir': 'जम्मू आणि काश्मीर',
  'Jharkhand': 'झारखंड',
  'Karnataka': 'कर्नाटक',
  'Kerala': 'केरळ',
  'Ladakh': 'लडाख',
  'Madhya Pradesh': 'मध्य प्रदेश',
  'Manipur': 'मणिपूर',
  'Meghalaya': 'मेघालय',
  'Mizoram': 'मिझोरम',
  'Nagaland': 'नागालँड',
  'Odisha': 'ओडिशा',
  'Puducherry': 'पुदुच्चेरी',
  'Punjab': 'पंजाब',
  'Rajasthan': 'राजस्थान',
  'Sikkim': 'सिक्कीम',
  'Tamil Nadu': 'तमिळनाडू',
  'Telangana': 'तेलंगणा',
  'Tripura': 'त्रिपुरा',
  'Uttar Pradesh': 'उत्तर प्रदेश',
  'Uttarakhand': 'उत्तराखंड',
  'West Bengal': 'पश्चिम बंगाल',
  'Ahilyanagar': 'अहिल्यानगर',
  'Amravati': 'अमरावती',
  'Chhatrapati Sambhajinagar': 'छत्रपती संभाजीनगर',
  'Jalgaon': 'जळगाव',
  'Latur': 'लातूर',
  'Mumbai': 'मुंबई',
  'Nagpur': 'नागपूर',
  'Nanded': 'नांदेड',
  'Nashik': 'नाशिक',
  'Navi Mumbai': 'नवी मुंबई',
  'Ratnagiri': 'रत्नागिरी',
  'Sangli': 'सांगली',
  'Solapur': 'सोलापूर',
  'Thane': 'ठाणे',
  'Guntur': 'गुंटूर',
  'Kurnool': 'कर्नूल',
  'Nellore': 'नेल्लोर',
  'Tirupati': 'तिरुपती',
  'Vijayawada': 'विजयवाडा',
  'Visakhapatnam': 'विशाखापट्टणम',
  'Itanagar': 'इटानगर',
  'Dibrugarh': 'दिब्रुगड',
  'Guwahati': 'गुवाहाटी',
  'Silchar': 'सिलचर',
  'Gaya': 'गया',
  'Muzaffarpur': 'मुझफ्फरपूर',
  'Patna': 'पाटणा',
  'Bilaspur': 'बिलासपूर',
  'Raipur': 'रायपूर',
  'Silvassa': 'सिल्वासा',
  'New Delhi': 'नवी दिल्ली',
  'Margao': 'मडगाव',
  'Panaji': 'पणजी',
  'Ahmedabad': 'अहमदाबाद',
  'Bhavnagar': 'भावनगर',
  'Gandhinagar': 'गांधीनगर',
  'Jamnagar': 'जामनगर',
  'Rajkot': 'राजकोट',
  'Surat': 'सुरत',
  'Vadodara': 'वडोदरा',
  'Ambala': 'अंबाला',
  'Faridabad': 'फरिदाबाद',
  'Gurugram': 'गुरुग्राम',
  'Hisar': 'हिसार',
  'Dharamshala': 'धर्मशाला',
  'Manali': 'मनाली',
  'Shimla': 'शिमला',
  'Jammu': 'जम्मू',
  'Srinagar': 'श्रीनगर',
  'Dhanbad': 'धनबाद',
  'Jamshedpur': 'जमशेदपूर',
  'Ranchi': 'रांची',
  'Belagavi': 'बेळगाव',
  'Bengaluru': 'बंगळुरू',
  'Hubballi': 'हुबळी',
  'Kalaburagi': 'कलबुर्गी',
  'Mangaluru': 'मंगळुरू',
  'Mysuru': 'म्हैसूर',
  'Kochi': 'कोची',
  'Kozhikode': 'कोझिकोड',
  'Thiruvananthapuram': 'तिरुवनंतपुरम',
  'Thrissur': 'त्रिशूर',
  'Leh': 'लेह',
  'Bhopal': 'भोपाळ',
  'Gwalior': 'ग्वाल्हेर',
  'Indore': 'इंदूर',
  'Jabalpur': 'जबलपूर',
  'Ujjain': 'उज्जैन',
  'Imphal': 'इंफाळ',
  'Shillong': 'शिलाँग',
  'Aizawl': 'ऐझॉल',
  'Kohima': 'कोहिमा',
  'Bhubaneswar': 'भुवनेश्वर',
  'Cuttack': 'कटक',
  'Puri': 'पुरी',
  'Rourkela': 'राउरकेला',
  'Amritsar': 'अमृतसर',
  'Jalandhar': 'जालंधर',
  'Ludhiana': 'लुधियाना',
  'Patiala': 'पटियाला',
  'Ajmer': 'अजमेर',
  'Bikaner': 'बिकानेर',
  'Jaipur': 'जयपूर',
  'Jodhpur': 'जोधपूर',
  'Kota': 'कोटा',
  'Udaipur': 'उदयपूर',
  'Gangtok': 'गंगटोक',
  'Chennai': 'चेन्नई',
  'Coimbatore': 'कोइम्बतूर',
  'Kanniyakumari': 'कन्याकुमारी',
  'Madurai': 'मदुराई',
  'Salem': 'सेलम',
  'Tiruchirappalli': 'तिरुचिरापल्ली',
  'Tirunelveli': 'तिरुनेलवेली',
  'Vellore': 'वेल्लोर',
  'Hyderabad': 'हैदराबाद',
  'Nizamabad': 'निजामाबाद',
  'Warangal': 'वारंगल',
  'Agartala': 'आगरताळा',
  'Agra': 'आग्रा',
  'Ayodhya': 'अयोध्या',
  'Bareilly': 'बरेली',
  'Ghaziabad': 'गाझियाबाद',
  'Gorakhpur': 'गोरखपूर',
  'Kanpur': 'कानपूर',
  'Lucknow': 'लखनौ',
  'Mathura': 'मथुरा',
  'Meerut': 'मेरठ',
  'Noida': 'नोएडा',
  'Prayagraj': 'प्रयागराज',
  'Varanasi': 'वाराणसी',
  'Dehradun': 'डेहराडून',
  'Haridwar': 'हरिद्वार',
  'Nainital': 'नैनिताल',
  'Rishikesh': 'ऋषिकेश',
  'Asansol': 'आसनसोल',
  'Darjeeling': 'दार्जिलिंग',
  'Durgapur': 'दुर्गापूर',
  'Kolkata': 'कोलकाता',
  'Siliguri': 'सिलिगुडी',
  // The live interface
  'Could not refresh':
    'ताजे करता आले नाही',
  'Live':
    'थेट',
  'updated {time}':
    '{time} अपडेट झाले',
  'Refresh now':
    'आता ताजे करा',
  'Leaves in {time}':
    '{time} मध्ये निघेल',
  'Back online':
    'पुन्हा ऑनलाइन',
  'You are offline. What you see may be out of date.':
    'तुम्ही ऑफलाइन आहात. जे दिसत आहे ते जुने असू शकते.',
  'See all notifications':
    'सर्व सूचना पाहा',
  'Recent notifications':
    'अलीकडील सूचना',
  'Operations':
    'कामकाज',
  'Trust and safety':
    'विश्वास आणि सुरक्षा',
  'Insights':
    'विश्लेषण',
  'Recent':
    'अलीकडील',
  'Near me':
    'माझ्या जवळ',
  'No place by that name is listed. Choose the nearest, then pick the exact point on the map.':
    'या नावाचे ठिकाण यादीत नाही. सर्वात जवळचे निवडा, मग नकाशावर अचूक ठिकाण निवडा.',
  'Today':
    'आज',
  'Tomorrow':
    'उद्या',
  'Time left on the hold':
    'होल्डचा उरलेला वेळ',
  'Swap start and destination':
    'सुरुवात आणि गंतव्य अदलाबदल करा',
  '{n} ride found':
    '{n} प्रवास सापडला',
  '{n} rides found':
    '{n} प्रवास सापडले',
  'Seats are live':
    'जागा थेट दिसत आहेत',
  'This ride is no longer available.':
    'हा प्रवास आता उपलब्ध नाही.',
  'Too few seats are left on this ride now.':
    'या प्रवासात आता खूप कमी जागा उरल्या आहेत.',
  'More about this ride':
    'या प्रवासाबद्दल अधिक',
  'Requested':
    'विनंती केली',
  'Accepted':
    'स्वीकारली',
  'Under way':
    'सुरू झाला',
  'Arrived':
    'पोहोचलो',
  'How far this booking has got':
    'ही बुकिंग कुठपर्यंत आली आहे',
  'Your ride is on the road. Open the chat to see where the driver is.':
    'तुमचा प्रवास सुरू आहे. चालक कुठे आहे हे पाहण्यासाठी चॅट उघडा.',
  'Coming up':
    'येणारे',
  'Earlier':
    'आधीचे',
  'Last sent {time}.':
    'शेवटचे {time} पाठवले.',
  'Connected':
    'जोडलेले',
  'Connection lost. Reconnecting…':
    'कनेक्शन तुटले. पुन्हा जोडत आहे…',
  'Rides ahead':
    'येणारे प्रवास',
  'Seats booked on them':
    'त्यावर बुक झालेल्या जागा',
  'Your next ride':
    'तुमचा पुढचा प्रवास',
  'Time to set off':
    'निघण्याची वेळ झाली',
  'In the last 7 days':
    'गेल्या 7 दिवसांत',
  'Example':
    'उदाहरण',
  // Paying the driver directly, in cash or by UPI
  'Paid to you each week (₹)':
    'दर आठवड्याला तुम्हाला मिळालेले पैसे (₹)',
  'UPI ID':
    'UPI आयडी',
  'Copied':
    'कॉपी झाले',
  'Copy':
    'कॉपी करा',
  'Open in my UPI app':
    'माझ्या UPI ॲपमध्ये उघडा',
  'Pay {name} {amount} in cash, or by UPI from your own app.':
    '{name} यांना {amount} रोख द्या, किंवा तुमच्या UPI ॲपमधून पाठवा.',
  'Pay {name} {amount} in cash: they have not given a UPI ID or QR code.':
    '{name} यांना {amount} रोख द्या: त्यांनी UPI आयडी किंवा QR कोड दिलेला नाही.',
  'UPI QR code of {name}':
    '{name} यांचा UPI QR कोड',
  'Check the name your UPI app shows before you pay. VAYORA never sees this money and cannot get it back.':
    'पैसे भरण्यापूर्वी तुमच्या UPI ॲपमध्ये दिसणारे नाव तपासा. VAYORA ला हे पैसे कधीच दिसत नाहीत आणि ते परत मिळवून देऊ शकत नाही.',
  'Paid in cash':
    'रोख मिळाले',
  'Paid by UPI':
    'UPI ने मिळाले',
  'Yes, I was paid {amount} by UPI':
    'हो, मला UPI ने {amount} मिळाले',
  'Passengers pay you directly after the ride, in cash or by UPI, and VAYORA takes nothing. They see these only once their booking is confirmed.':
    'प्रवासी प्रवासानंतर थेट तुम्हाला रोख किंवा UPI ने पैसे देतात, आणि VAYORA काहीही घेत नाही. त्यांची बुकिंग निश्चित झाल्यावरच प्रवाशांना हे तपशील दिसतात.',
  'Your UPI ID':
    'तुमचा UPI आयडी',
  'As your UPI app shows it, like name@bank.':
    'तुमच्या UPI ॲपमध्ये दिसतो तसा, उदा. name@bank.',
  'Save UPI ID':
    'UPI आयडी जतन करा',
  'Your UPI ID is saved.':
    'तुमचा UPI आयडी जतन झाला आहे.',
  'Your UPI ID is removed.':
    'तुमचा UPI आयडी काढला आहे.',
  'Your UPI QR code':
    'तुमचा UPI QR कोड',
  'Choose your UPI QR code':
    'तुमचा UPI QR कोड निवडा',
  'Replace QR code':
    'QR कोड बदला',
  'Add a QR code':
    'QR कोड जोडा',
  'Remove QR code':
    'QR कोड काढा',
  'A screenshot from your UPI app, as a JPEG or PNG up to 5 MB. Scan it yourself once it is up, to check it still works.':
    'तुमच्या UPI ॲपचा स्क्रीनशॉट, JPEG किंवा PNG मध्ये, 5 MB पर्यंत. अपलोड केल्यावर तो चालतो का ते स्वतः स्कॅन करून तपासा.',
  'Before the driver accepts: nothing to pay.':
    'चालकाने स्वीकारण्यापूर्वी: काहीही द्यायचे नाही.',
  '{when}: nothing to pay.':
    '{when}: काहीही द्यायचे नाही.',
  '{when}: {share} of the fare to your driver.':
    '{when}: भाड्याचा {share} तुमच्या चालकाला.',
  'Less than {hours} hours before boarding, or if you do not turn up: the whole fare to your driver.':
    'बसण्याच्या {hours} तासांपेक्षा कमी आधी, किंवा तुम्ही न आल्यास: संपूर्ण भाडे तुमच्या चालकाला.',
  'If the driver cancels or declines: nothing to pay.':
    'चालकाने रद्द केल्यास किंवा नाकारल्यास: काहीही द्यायचे नाही.',
  'You cannot book again until your driver marks what you owe as paid.':
    'तुमच्या चालकाने देय रक्कम मिळाल्याची नोंद करेपर्यंत तुम्ही पुन्हा बुक करू शकत नाही.',
  'The driver did not answer your request for {seats} in time, so it has been closed. You owe nothing.':
    'चालकाने {seats} साठीच्या तुमच्या विनंतीला वेळेत उत्तर दिले नाही, म्हणून ती बंद केली आहे. तुम्हाला काहीही द्यायचे नाही.',
  'The driver did not accept your request for {seats}. You owe nothing.':
    'चालकाने {seats} साठीची तुमची विनंती स्वीकारली नाही. तुम्हाला काहीही द्यायचे नाही.',
  'The driver reported that you did not board for {seats}.':
    'चालकाने कळवले की तुम्ही {seats} साठी बसला नाहीत.',
  'The driver cancelled the ride you booked for {seats}. You owe nothing. {more}':
    'तुम्ही {seats} बुक केलेली राइड चालकाने रद्द केली. तुम्हाला काहीही द्यायचे नाही. {more}',
  'Your seat from {from} to {to} leaves {when}. If your plans have changed, cancelling now lets someone else take it, and you would owe nothing. If you are still travelling, there is nothing to do.':
    '{from} ते {to} तुमची जागा {when} ला निघते. तुमचे नियोजन बदलले असल्यास, आत्ता रद्द केल्याने दुसऱ्या कोणाला ती मिळू शकते, आणि तुम्हाला काहीही द्यावे लागणार नाही. तुम्ही प्रवास करत असाल तर काहीही करण्याची गरज नाही.',
  'Your seat from {from} to {to} leaves {when}. If your plans have changed, cancelling now lets someone else take it, and you would owe your driver Rs {owed} of your Rs {fare} fare. If you are still travelling, there is nothing to do.':
    '{from} ते {to} तुमची जागा {when} ला निघते. तुमचे नियोजन बदलले असल्यास, आत्ता रद्द केल्याने दुसऱ्या कोणाला ती मिळू शकते, आणि तुमच्या Rs {fare} भाड्यापैकी Rs {owed} चालकाला द्यावे लागतील. तुम्ही प्रवास करत असाल तर काहीही करण्याची गरज नाही.',
  'Your trip from {from} to {to} is complete. Pay your driver Rs {amount}, in cash or by UPI: see My bookings.':
    '{from} ते {to} हा तुमचा प्रवास पूर्ण झाला. तुमच्या चालकाला Rs {amount} रोख किंवा UPI ने द्या: माझी बुकिंग पाहा.',
  'The driver reported that you did not board for {seats}. The full Rs {amount} is owed to them: see My bookings.':
    'चालकाने कळवले की तुम्ही {seats} साठी बसला नाहीत. पूर्ण Rs {amount} त्यांना द्यायचे आहेत: माझी बुकिंग पाहा.',
  '{passenger} cancelled {seats}, late enough to owe you Rs {amount}.':
    '{passenger} यांनी {seats} उशिरा रद्द केली, म्हणून तुम्हाला Rs {amount} मिळायचे आहेत.',
  'Your driver recorded Rs {amount} paid by UPI for {seats}.':
    'तुमच्या चालकाने {seats} साठी Rs {amount} UPI ने मिळाल्याची नोंद केली.',
  'VAYORA staff cleared what you owed for {seats}, so you can book again.':
    'VAYORA कर्मचाऱ्यांनी {seats} साठीची तुमची देय रक्कम काढून टाकली आहे, म्हणून तुम्ही पुन्हा बुक करू शकता.',
  'VAYORA staff cleared what {passenger} owed you for {seats}.':
    'VAYORA कर्मचाऱ्यांनी {seats} साठी {passenger} यांची तुम्हाला देय रक्कम काढून टाकली आहे.',
  'The trip':
    'प्रवास',
  'A seat you did not take up':
    'तुम्ही न घेतलेली जागा',
  'Cancelling late':
    'उशिरा रद्द करणे',
  'You still owe a driver for an earlier booking. You can book again once they mark it paid: see My bookings.':
    'मागील बुकिंगचे पैसे अजून चालकाला द्यायचे आहेत. त्यांनी मिळाल्याची नोंद केल्यावर तुम्ही पुन्हा बुक करू शकाल: माझी बुकिंग पाहा.',
  'That does not look like a UPI ID. It looks like name@bank, as your UPI app shows it':
    'हा UPI आयडी वाटत नाही. तो name@bank सारखा असतो, तुमच्या UPI ॲपमध्ये दिसतो तसा',
  'No QR code':
    'QR कोड नाही',
  'How passengers pay you':
    'प्रवासी तुम्हाला पैसे कसे देतात',
  'Only those still owing a driver':
    'फक्त ज्यांच्याकडे चालकाचे पैसे बाकी आहेत',
  'Owes the driver {amount}':
    'चालकाला {amount} द्यायचे आहेत',
  'Why clear it':
    'हे का काढत आहात',
  'For a driver who was paid and will not mark it. Kept in the audit log, and not shown to either side.':
    'ज्या चालकाला पैसे मिळाले पण जो नोंद करत नाही त्याच्यासाठी. हे ऑडिट लॉगमध्ये राहते आणि दोन्ही बाजूंना दिसत नाही.',
  'Clear what is owed':
    'देय रक्कम काढा',
  'Yes, clear it':
    'हो, काढा',
  'Passengers pay you directly after the ride, in cash or by UPI.':
    'प्रवासी प्रवासानंतर थेट तुम्हाला रोख किंवा UPI ने पैसे देतात.',
  'Your UPI ID and QR code':
    'तुमचा UPI आयडी आणि QR कोड',
  '{amount} owed to you':
    'तुम्हाला {amount} मिळायचे आहेत',
  'Passengers pay you directly, in cash or by UPI, and VAYORA takes nothing. What shows here is what you marked as paid.':
    'प्रवासी थेट तुम्हाला रोख किंवा UPI ने पैसे देतात, आणि VAYORA काहीही घेत नाही. तुम्ही मिळाल्याची नोंद केलेलेच इथे दिसते.',
  'Nothing yet. Once a trip ends, what passengers owe you shows here.':
    'अजून काही नाही. प्रवास संपल्यावर प्रवाशांकडून येणे रक्कम इथे दिसेल.',
  'Waiting to be paid':
    'पैशांच्या प्रतीक्षेत',
  'A passenger cannot book again until you mark what they owe as paid.':
    'तुम्ही देय रक्कम मिळाल्याची नोंद करेपर्यंत प्रवासी पुन्हा बुक करू शकत नाही.',
  'Total paid to you':
    'तुम्हाला एकूण मिळाले',
  'The earlier you cancel, the less you owe':
    'जितक्या लवकर रद्द कराल, तितके कमी द्यावे लागेल',
  'Your seat is held while you decide':
    'निर्णय घेताना तुमची सीट राखून ठेवली जाते',
  'Pay the driver directly, in cash or by UPI':
    'चालकाला थेट रोख किंवा UPI ने पैसे द्या',
  'Keep the whole fare: VAYORA charges nothing':
    'संपूर्ण भाडे तुमचे: VAYORA काहीही घेत नाही',
  'A final-year project at DYPCET, Kolhapur. Text messages and calls are simulated unless real services are connected.':
    'DYPCET, कोल्हापूर येथील अंतिम वर्षाचा प्रकल्प. खऱ्या सेवा जोडल्या जाईपर्यंत मजकूर संदेश आणि कॉल अनुकरणित आहेत.',
  'Nothing to pay now: pay your driver {amount} after the ride, in cash or by UPI.':
    'आत्ता काहीही द्यायचे नाही: प्रवासानंतर तुमच्या चालकाला {amount} रोख किंवा UPI ने द्या.',
  'You pay your driver directly after the ride, in cash or by UPI. VAYORA charges nothing.':
    'तुम्ही प्रवासानंतर थेट तुमच्या चालकाला रोख किंवा UPI ने पैसे देता. VAYORA काहीही घेत नाही.',
  'Flexible and any time book you on another ride automatically. The price is the same.':
    'लवचिक आणि केव्हाही निवडल्यास तुम्हाला आपोआप दुसऱ्या राइडवर बुक केले जाते. किंमत तीच राहते.',
  'If you cancel now, you owe your driver the whole fare.':
    'तुम्ही आत्ता रद्द केल्यास संपूर्ण भाडे चालकाला द्यावे लागेल.',
  'If you cancel now, you owe nothing. In {time} that rises to {next}.':
    'तुम्ही आत्ता रद्द केल्यास काहीही द्यायचे नाही. {time} मध्ये हे वाढून {next} होईल.',
  'If you cancel now, you owe your driver {amount}. In {time} that rises to {next}.':
    'तुम्ही आत्ता रद्द केल्यास चालकाला {amount} द्यावे लागतील. {time} मध्ये हे वाढून {next} होईल.',
  '{amount} owed to your driver':
    'चालकाला {amount} द्यायचे आहेत',
  'paid by UPI':
    'UPI ने दिले',
  'paid in cash':
    'रोख दिले',
  'The driver has until {time} to answer. After that the request closes and you owe nothing.':
    'चालकाकडे उत्तर देण्यासाठी {time} पर्यंत वेळ आहे. त्यानंतर विनंती बंद होईल आणि तुम्हाला काहीही द्यायचे नाही.',
  'You owe your driver {amount}. You can book again once they mark it paid.':
    'तुम्हाला तुमच्या चालकाला {amount} द्यायचे आहेत. त्यांनी नोंद केल्यावर तुम्ही पुन्हा बुक करू शकाल.',
  'Paid, and they will not mark it?':
    'पैसे दिले, पण ते नोंद करत नाहीत?',
  'Report it on their profile, and staff can clear it.':
    'त्यांच्या प्रोफाइलवर तक्रार करा, कर्मचारी ते काढू शकतात.',
  'How to pay your driver':
    'तुमच्या चालकाला पैसे कसे द्यावे',
  'You owe {amount}. You can book again once your driver marks it paid.':
    'तुम्हाला {amount} द्यायचे आहेत. तुमच्या चालकाने नोंद केल्यावर तुम्ही पुन्हा बुक करू शकाल.',
  'See My bookings':
    'माझी बुकिंग पाहा',
  'You have not booked anything yet.':
    'तुम्ही अजून काहीही बुक केलेले नाही.',
  'Paid to your drivers':
    'तुमच्या चालकांना दिलेले',
  'Where it stands':
    'स्थिती',
  '{amount} paid':
    '{amount} दिले',
  'For':
    'कशासाठी',
  'Paid to the driver':
    'चालकाला दिले',
  'Paid directly to the driver, as the driver recorded it. VAYORA took no part of it and charged nothing.':
    'थेट चालकाला दिले, चालकाने नोंदवल्याप्रमाणे. VAYORA ने यातून काहीही घेतले नाही आणि कोणतेही शुल्क आकारले नाही.',
  'Your seat is held while you decide. Many drivers confirm at once; the others answer your request. You pay your driver after the ride.':
    'निर्णय घेताना तुमची सीट राखून ठेवली जाते. बरेच चालक लगेच निश्चित करतात; बाकीचे तुमच्या विनंतीला उत्तर देतात. तुम्ही प्रवासानंतर तुमच्या चालकाला पैसे देता.',
  '{n} rides cancelled. Every passenger has been told, and owes nothing.':
    '{n} राइड रद्द केल्या. प्रत्येक प्रवाशाला कळवले आहे, आणि त्यांना काहीही द्यायचे नाही.',
  // Getting started, for a new driver
  'Get set up':
    'सुरुवात करा',
  '{done} of {all} done':
    '{all} पैकी {done} पूर्ण',
  'Add your car':
    'तुमची कार जोडा',
  'Add your UPI ID or QR code, so passengers can pay you':
    'तुमचा UPI आयडी किंवा QR कोड जोडा, म्हणजे प्रवासी तुम्हाला पैसे देऊ शकतील',
  'Confirm your email or phone':
    'तुमचा ईमेल किंवा फोन निश्चित करा',
  'Publish your first ride':
    'तुमचा पहिला प्रवास प्रकाशित करा',
  '{step}: done':
    '{step}: पूर्ण',
};
