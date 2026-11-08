// Hindi. Keys are the English strings in the source; placeholders in {braces} must be
// kept exactly. Written without review by a native speaker: the wording on money,
// refunds and safety in particular should be checked before anyone relies on it.

export const hi: Record<string, string> = {
  // Navigation and shell
  'Page not found': 'पृष्ठ नहीं मिला',
  'There is nothing at this address.': 'इस पते पर कुछ नहीं है।',
  'Find a ride': 'सवारी खोजें',
  'My bookings': 'मेरी बुकिंग',
  'My rides': 'मेरी सवारियाँ',
  'Publish a ride': 'सवारी प्रकाशित करें',
  'My vehicles': 'मेरे वाहन',
  Earnings: 'कमाई',
  Overview: 'सारांश',
  Reports: 'शिकायतें',
  Members: 'सदस्य',
  'Booking durability': 'बुकिंग की स्थिरता',
  'Audit log': 'ऑडिट लॉग',
  Notifications: 'सूचनाएँ',
  unread: 'अपठित',
  Language: 'भाषा',
  'Skip to content': 'सीधे सामग्री पर जाएँ',
  Main: 'मुख्य',
  'Sign out': 'साइन आउट',
  'Keep it': 'रहने दें',
  'Loading…': 'लोड हो रहा है…',
  'Try again': 'फिर से कोशिश करें',
  Reload: 'फिर से लोड करें',
  'This screen could not be loaded. VAYORA may have been updated: reload to get the new version.':
    'यह स्क्रीन लोड नहीं हो सकी। VAYORA शायद अपडेट हुआ है: नया संस्करण पाने के लिए फिर से लोड करें।',
  'Week of {date}':
    '{date} वाला सप्ताह',
  'Fewer seats':
    'कम सीटें',
  'More seats':
    'ज़्यादा सीटें',
  'Light':
    'हल्का',
  'Dark':
    'गहरा',
  'Match device':
    'डिवाइस जैसा',
  'Theme: {name}':
    'थीम: {name}',
  // Staff checks of identity documents and insurance
  'Declare an identity document first':
    'पहले कोई पहचान पत्र घोषित करें',
  "Declare this car's insurance first":
    'पहले इस कार का बीमा घोषित करें',
  'Say which car the insurance is for':
    'बताएँ कि बीमा किस कार के लिए है',
  'This is already waiting for VAYORA staff':
    'यह पहले से VAYORA कर्मचारियों के पास प्रतीक्षा में है',
  'VAYORA staff have already checked this':
    'VAYORA कर्मचारी इसकी जाँच पहले ही कर चुके हैं',
  'No check is waiting with that id':
    'इस आईडी की कोई जाँच प्रतीक्षा में नहीं है',
  'Say why it could not be confirmed':
    'बताएँ कि इसकी पुष्टि क्यों नहीं हो सकी',
  'VAYORA staff have checked your identity document.':
    'VAYORA कर्मचारियों ने आपके पहचान पत्र की जाँच कर ली है।',
  'VAYORA staff could not confirm your identity document: {note}':
    'VAYORA कर्मचारी आपके पहचान पत्र की पुष्टि नहीं कर सके: {note}',
  'VAYORA staff have checked the insurance for {vehicle}.':
    'VAYORA कर्मचारियों ने {vehicle} के बीमे की जाँच कर ली है।',
  'VAYORA staff could not confirm the insurance for {vehicle}: {note}':
    'VAYORA कर्मचारी {vehicle} के बीमे की पुष्टि नहीं कर सके: {note}',
  'Ask VAYORA staff to check it':
    'VAYORA कर्मचारियों से इसकी जाँच करने को कहें',
  'You show the original to VAYORA staff, in person or on a video call. They record only the result: no number and no copy is kept.':
    'आप मूल दस्तावेज़ VAYORA कर्मचारियों को दिखाते हैं, आमने-सामने या वीडियो कॉल पर। वे केवल परिणाम दर्ज करते हैं: कोई नंबर और कोई प्रति नहीं रखी जाती।',
  'Waiting for VAYORA staff. They will contact you to see the original.':
    'VAYORA कर्मचारियों की प्रतीक्षा है। वे मूल दस्तावेज़ देखने के लिए आपसे संपर्क करेंगे।',
  'Checked by VAYORA staff on {date}. A person saw it; it was not checked with its issuer.':
    '{date} को VAYORA कर्मचारियों ने जाँचा। एक व्यक्ति ने इसे देखा; जारी करने वाले से इसकी जाँच नहीं हुई।',
  'VAYORA staff could not confirm it: {note}':
    'VAYORA कर्मचारी इसकी पुष्टि नहीं कर सके: {note}',
  '{document}, checked by VAYORA staff':
    '{document}, VAYORA कर्मचारियों द्वारा जाँचा गया',
  'A person at VAYORA saw this document. It was not checked with its issuer.':
    'VAYORA के एक व्यक्ति ने यह दस्तावेज़ देखा। जारी करने वाले से इसकी जाँच नहीं हुई।',
  'Identity checked by staff':
    'कर्मचारियों ने पहचान जाँची',
  'Insurance: {insurer}, until {date}. VAYORA staff saw the policy; it was not checked with the insurer.':
    'बीमा: {insurer}, {date} तक। VAYORA कर्मचारियों ने पॉलिसी देखी; बीमा कंपनी से इसकी जाँच नहीं हुई।',
  'Have a driver whose identity VAYORA staff have checked':
    'ऐसा चालक हो जिसकी पहचान VAYORA कर्मचारियों ने जाँची हो',
  'Document checks':
    'दस्तावेज़ जाँच',
  'Ask the driver to show you the original, in person or on a video call, then record what you saw. Do not write down its number or keep a copy. This says a person saw it, not that its issuer stands behind it.':
    'चालक से मूल दस्तावेज़ दिखाने को कहें, आमने-सामने या वीडियो कॉल पर, फिर दर्ज करें कि आपने क्या देखा। उसका नंबर न लिखें और प्रति न रखें। इससे पता चलता है कि एक व्यक्ति ने उसे देखा, यह नहीं कि जारी करने वाला उसकी पुष्टि करता है।',
  'No document is waiting to be checked.':
    'कोई दस्तावेज़ जाँच की प्रतीक्षा में नहीं है।',
  'Identity document: {document}':
    'पहचान पत्र: {document}',
  'Insurance for {vehicle}: {insurer}, until {date}':
    '{vehicle} का बीमा: {insurer}, {date} तक',
  'Asked {when}':
    '{when} को अनुरोध किया',
  'Note for the driver (needed to refuse)':
    'चालक के लिए टिप्पणी (मना करने के लिए ज़रूरी)',
  'Mark as checked':
    'जाँचा हुआ चिह्नित करें',
  'Yes, I saw the original':
    'हाँ, मैंने मूल दस्तावेज़ देखा',
  'Could not confirm':
    'पुष्टि नहीं हो सकी',
  // Publishing a ride, in numbered parts
  'When, and in which car':
    'कब, और किस कार में',
  'Where you stop':
    'आप कहाँ रुकते हैं',
  'Who rides, and how':
    'कौन जाता है, और कैसे',
  'Return and repeat':
    'वापसी और दोहराना',
  'Your ride':
    'आपकी सवारी',
  'Not chosen yet':
    'अभी चुना नहीं',
  'Leaving':
    'रवानगी',
  'Whole way, per seat':
    'पूरा रास्ता, प्रति सीट',
  'Rides to publish':
    'प्रकाशित होने वाली सवारियाँ',
  // Command palette
  'Go to…':
    'यहाँ जाएँ…',
  'Search pages and actions':
    'पेज और कार्य खोजें',
  'Pages':
    'पेज',
  'Theme':
    'थीम',
  'Actions':
    'कार्य',
  'Nothing matches that.':
    'इससे कुछ मेल नहीं खाता।',
  'Arrows to move, Enter to choose, Esc to close':
    'चलने के लिए तीर, चुनने के लिए Enter, बंद करने के लिए Esc',
  'More':
    'और',
  'Something went wrong on this screen.':
    'इस स्क्रीन पर कुछ गड़बड़ हो गई।',

  // Payments and cancelling
  'If you cancel': 'यदि आप रद्द करते हैं',
  '{hours} hours or more before boarding': 'सवार होने से {hours} घंटे या उससे अधिक पहले',
  '{from} to {to} hours before boarding': 'सवार होने से {from} से {to} घंटे पहले',

  // Ratings
  'No ratings yet': 'अभी कोई रेटिंग नहीं',
  '{average} out of 5 · {count} rating': '5 में से {average} · {count} रेटिंग',
  '{average} out of 5 · {count} ratings': '5 में से {average} · {count} रेटिंग',
  '{n} star': '{n} स्टार',
  '{n} stars': '{n} स्टार',
  'Comment (optional, shown on their profile)': 'टिप्पणी (वैकल्पिक, उनकी प्रोफ़ाइल पर दिखेगी)',
  'Sending…': 'भेजा जा रहा है…',
  'Send rating': 'रेटिंग भेजें',
  'Rate your driver': 'अपने चालक को रेटिंग दें',
  'Rate {name}': '{name} को रेटिंग दें',

  // Reports
  'Unsafe driving': 'असुरक्षित ड्राइविंग',
  Harassment: 'उत्पीड़न',
  'Did not turn up': 'नहीं आए',
  Fraud: 'धोखाधड़ी',
  'Something else': 'कुछ और',
  'Your report has been sent to the administrators. They will not tell {name} who filed it.':
    'आपकी शिकायत प्रशासकों को भेज दी गई है। वे {name} को यह नहीं बताएँगे कि शिकायत किसने की।',
  'Report {name}': '{name} की शिकायत करें',
  'What happened?': 'क्या हुआ?',
  'Choose one': 'एक चुनें',
  'Details (optional)': 'विवरण (वैकल्पिक)',
  'If you are in danger now, call 112. A report here is read by an administrator later, not straight away.':
    'यदि आप अभी खतरे में हैं, तो 112 पर कॉल करें। यहाँ की गई शिकायत प्रशासक बाद में पढ़ते हैं, तुरंत नहीं।',
  'Send report': 'शिकायत भेजें',
  'Never mind': 'रहने दें',

  // Statuses
  'Waiting for the driver': 'चालक के उत्तर की प्रतीक्षा',
  Confirmed: 'पुष्टि हो गई',
  'Declined by the driver': 'चालक ने अस्वीकार किया',
  Cancelled: 'रद्द',
  Completed: 'पूरी हुई',
  'Did not board': 'सवार नहीं हुए',
  Scheduled: 'निर्धारित',
  'On the road': 'रास्ते में',

  // Places and units
  Kolhapur: 'कोल्हापुर',
  Karad: 'कराड',
  Satara: 'सातारा',
  Pune: 'पुणे',
  '{n} m': '{n} मी',
  '{n} km': '{n} किमी',
  '{m} min': '{m} मिनट',
  '{h} h': '{h} घंटे',
  '{h} h {m} min': '{h} घंटे {m} मिनट',

  // Validation
  'Enter your email': 'अपना ईमेल दर्ज करें',
  'Enter a valid email': 'मान्य ईमेल दर्ज करें',
  'Enter your password': 'अपना पासवर्ड दर्ज करें',
  'Enter your name': 'अपना नाम दर्ज करें',
  'Use at least 8 characters': 'कम से कम 8 अक्षर रखें',
  'Use at most 72 characters': 'अधिकतम 72 अक्षर रखें',
  'Choose how you will use VAYORA': 'चुनें कि आप VAYORA का उपयोग कैसे करेंगे',
  'Choose where you start': 'चुनें कि आप कहाँ से चलेंगे',
  'Choose where you are going': 'चुनें कि आप कहाँ जा रहे हैं',
  'Choose a date': 'तारीख चुनें',
  'At least 1 seat': 'कम से कम 1 सीट',
  'At most 8 seats': 'अधिकतम 8 सीटें',
  'Enter the make': 'कंपनी का नाम दर्ज करें',
  'Enter the model': 'मॉडल दर्ज करें',
  'Too old': 'बहुत पुराना',
  'Check the year': 'वर्ष जाँचें',
  'At least 2, counting the driver': 'चालक सहित कम से कम 2',
  'At most 9': 'अधिकतम 9',
  'Choose a vehicle': 'वाहन चुनें',
  'Choose when you leave': 'चुनें कि आप कब निकलेंगे',
  'Offer at least 1 seat': 'कम से कम 1 सीट दें',
  'Choose a time in the future': 'आगे का कोई समय चुनें',
  'A ride needs at least two stops': 'सवारी में कम से कम दो पड़ाव होने चाहिए',
  'Enter whole minutes, up to two days': 'पूरे मिनट दर्ज करें, अधिकतम दो दिन',
  'Enter a price of 0 or more': '0 या उससे अधिक कीमत दर्ज करें',
  'Must be later than the stop before': 'पिछले पड़ाव से बाद का होना चाहिए',

  // Booking durability (administrator)
  "Each figure is a model's estimate that the passenger will not cancel before departure. The model was trained on simulated data only and separates risky from safe bookings weakly. It is not a fact about any person and must not be used to decline, penalise or price anyone. It is used for one thing: choosing whom the seat-release reminder asks.":
    'हर आँकड़ा एक मॉडल का अनुमान है कि यात्री प्रस्थान से पहले बुकिंग रद्द नहीं करेगा। मॉडल को केवल कृत्रिम (सिम्युलेटेड) डेटा पर प्रशिक्षित किया गया है और यह जोखिम वाली तथा सुरक्षित बुकिंग में कमज़ोर ढंग से ही अंतर कर पाता है। यह किसी व्यक्ति के बारे में तथ्य नहीं है और इसका उपयोग किसी को अस्वीकार करने, दंडित करने या उसके लिए कीमत तय करने में नहीं किया जाना चाहिए। इसका उपयोग केवल एक काम के लिए होता है: यह चुनना कि सीट छोड़ने का अनुस्मारक किसे भेजा जाए।',
  'Scoring…': 'अनुमान लगाया जा रहा है…',
  'Score bookings now': 'अभी बुकिंग का अनुमान लगाएँ',
  'Another scoring run is in progress.': 'अनुमान की एक और प्रक्रिया पहले से चल रही है।',
  '{scored} scored, {already} already scored today, {failed} could not be scored.':
    '{scored} का अनुमान लगा, {already} का आज पहले ही लग चुका था, {failed} का नहीं लग सका।',
  'The model service did not answer for some bookings. They are unchanged; run it again later.':
    'कुछ बुकिंग के लिए मॉडल सेवा ने उत्तर नहीं दिया। वे जस की तस हैं; बाद में फिर चलाएँ।',
  'No confirmed booking has been scored yet.': 'अभी तक किसी पुष्ट बुकिंग का अनुमान नहीं लगाया गया है।',
  'Latest durability estimate of each confirmed booking': 'हर पुष्ट बुकिंग का नवीनतम स्थिरता अनुमान',
  Booking: 'बुकिंग',
  Passenger: 'यात्री',
  Trip: 'यात्रा',
  Leaves: 'प्रस्थान',
  Estimate: 'अनुमान',
  Model: 'मॉडल',
  Scored: 'अनुमान का समय',

  // Signing in
  'Sign in': 'साइन इन करें',
  Email: 'ईमेल',
  Password: 'पासवर्ड',
  'Signing in…': 'साइन इन हो रहा है…',
  'New here?': 'पहली बार आए हैं?',
  'Create an account': 'खाता बनाएँ',
  'Full name': 'पूरा नाम',
  'At least 8 characters.': 'कम से कम 8 अक्षर।',
  'I want to': 'मैं चाहता/चाहती हूँ',
  'An account is either a passenger or a driver. This cannot be changed later.':
    'एक खाता या तो यात्री का होता है या चालक का। इसे बाद में बदला नहीं जा सकता।',
  'Find rides as a passenger': 'यात्री के रूप में सवारी खोजना',
  'Offer rides as a driver': 'चालक के रूप में सवारी देना',
  'Creating…': 'बनाया जा रहा है…',
  'Create account': 'खाता बनाएँ',
  'Already have an account?': 'पहले से खाता है?',

  // Back office
  Passengers: 'यात्री',
  Drivers: 'चालक',
  Administrators: 'प्रशासक',
  Driver: 'चालक',
  Administrator: 'प्रशासक',
  'None yet.': 'अभी कुछ नहीं।',
  '{n} report is waiting.': '{n} शिकायत प्रतीक्षा में है।',
  '{n} reports are waiting.': '{n} शिकायतें प्रतीक्षा में हैं।',
  'Open the queue': 'सूची खोलें',
  'Members by role': 'भूमिका के अनुसार सदस्य',
  'Rides by status': 'स्थिति के अनुसार सवारियाँ',
  'Bookings by status': 'स्थिति के अनुसार बुकिंग',
  'Suspended members: {n}': 'निलंबित सदस्य: {n}',
  'No reports are waiting.': 'कोई शिकायत प्रतीक्षा में नहीं है।',
  '{reason}: {reporter} about': '{reason}: {reporter} ने शिकायत की, इनके बारे में:',
  'Filed {time}': '{time} को दर्ज',
  'booking #{id}': 'बुकिंग #{id}',
  'Note for report #{id}': 'शिकायत #{id} के लिए टिप्पणी',
  'Kept with the report. Sent to the member if you warn them.':
    'शिकायत के साथ रखी जाती है। यदि आप सदस्य को चेतावनी देते हैं तो उन्हें भेजी जाती है।',
  Dismiss: 'खारिज करें',
  'Warn member': 'सदस्य को चेतावनी दें',
  'Suspend member': 'सदस्य को निलंबित करें',
  'Yes, suspend {name}': 'हाँ, {name} को निलंबित करें',
  'Name, email or phone': 'नाम, ईमेल या फ़ोन',
  Search: 'खोजें',
  'No member matches.': 'कोई सदस्य नहीं मिला।',
  'Members, newest first': 'सदस्य, सबसे नए पहले',
  Name: 'नाम',
  Role: 'भूमिका',
  Joined: 'शामिल हुए',
  Standing: 'स्थिति',
  Suspended: 'निलंबित',
  'Reinstate {name}': '{name} को बहाल करें',
  Active: 'सक्रिय',
  'Every administrative action, newest first. Entries cannot be edited or removed.':
    'हर प्रशासनिक कार्रवाई, सबसे नई पहले। प्रविष्टियों को बदला या हटाया नहीं जा सकता।',
  'No administrative action has been recorded.': 'कोई प्रशासनिक कार्रवाई दर्ज नहीं है।',
  'Administrative actions': 'प्रशासनिक कार्रवाइयाँ',
  When: 'कब',
  Who: 'किसने',
  Action: 'कार्रवाई',
  On: 'किस पर',
  Detail: 'विवरण',

  // Vehicles
  'Add a vehicle before you publish a ride.': 'सवारी प्रकाशित करने से पहले एक वाहन जोड़ें।',
  '{n} seats including yours': 'आपकी सीट सहित {n} सीटें',
  'Add a vehicle': 'वाहन जोड़ें',
  Make: 'कंपनी',
  'Year (optional)': 'वर्ष (वैकल्पिक)',
  'Colour (optional)': 'रंग (वैकल्पिक)',
  Seats: 'सीटें',
  "Every seat in the vehicle, counting the driver's.": 'वाहन की हर सीट, चालक की सीट सहित।',
  'Adding…': 'जोड़ा जा रहा है…',
  'Add vehicle': 'वाहन जोड़ें',

  // Publishing a ride
  'Route and meeting points': 'मार्ग और मिलने के स्थान',
  'A click on the map moves the meeting point for': 'नक्शे पर क्लिक करने से इसका मिलने का स्थान बदलेगा',
  'Each starts at the town centre. Put it where passengers should actually find you.':
    'हर स्थान शुरू में शहर के केंद्र पर होता है। इसे वहाँ रखें जहाँ यात्री आपको वास्तव में मिलें।',
  '{town} meeting point': '{town} में मिलने का स्थान',
  'Map of your stops: {stops}': 'आपके पड़ावों का नक्शा: {stops}',
  'Working out the route…': 'मार्ग निकाला जा रहा है…',
  'Work out the route': 'मार्ग निकालें',
  'Use the suggested prices and times': 'सुझाई गई कीमतें और समय अपनाएँ',
  '{km} km by road, about {time} of driving.': 'सड़क से {km} किमी, लगभग {time} की ड्राइविंग।',
  'About {km} km in a straight line. No road route is available for this trip, so this is not a road distance and the times are rough guesses.':
    'सीधी रेखा में लगभग {km} किमी। इस यात्रा के लिए सड़क मार्ग उपलब्ध नहीं है, इसलिए यह सड़क की दूरी नहीं है और समय केवल मोटे अनुमान हैं।',
  '{from} to {to}: {km} km, {time}, suggested {price} a seat': '{from} से {to}: {km} किमी, {time}, सुझाई गई कीमत {price} प्रति सीट',
  'The suggestion is distance times a flat rate. The price is yours to set.':
    'यह सुझाव दूरी को एक तय दर से गुणा करके निकाला गया है। कीमत तय करना आपके हाथ में है।',
  'You need a vehicle first.': 'पहले आपको एक वाहन चाहिए।',
  'Add one': 'वाहन जोड़ें',
  Vehicle: 'वाहन',
  '{vehicle} ({n} passenger seats)': '{vehicle} ({n} यात्री सीटें)',
  'Leaving at': 'निकलने का समय',
  "In your device's local time.": 'आपके डिवाइस के स्थानीय समय में।',
  'Seats offered': 'दी जाने वाली सीटें',
  'Confirm bookings instantly, without asking me': 'मुझसे पूछे बिना बुकिंग तुरंत पक्की करें',
  'Passengers can book between any two of your stops. Each price is for the stretch that ends at that stop.':
    'यात्री आपके किन्हीं भी दो पड़ावों के बीच बुकिंग कर सकते हैं। हर कीमत उस हिस्से की है जो उस पड़ाव पर खत्म होता है।',
  'Price to {town} (₹)': '{town} तक की कीमत (₹)',
  'Publishing…': 'प्रकाशित किया जा रहा है…',
  'Publish ride': 'सवारी प्रकाशित करें',

  // A driver's rides
  'You have not published a ride yet.': 'आपने अभी तक कोई सवारी प्रकाशित नहीं की है।',
  'Leaves {time}': 'प्रस्थान {time}',
  'Instant booking': 'तुरंत बुकिंग',
  'You approve requests': 'अनुरोध आप स्वीकार करते हैं',
  '{km} km by road, about {time}': 'सड़क से {km} किमी, लगभग {time}',
  'Start ride': 'सवारी शुरू करें',
  'Cancel ride': 'सवारी रद्द करें',
  'Yes, cancel for everyone': 'हाँ, सबके लिए रद्द करें',
  'Complete ride': 'सवारी पूरी करें',
  'Yes, we have arrived': 'हाँ, हम पहुँच गए हैं',
  '{from} → {to}: {free} of {total} seats free, {price}': '{from} → {to}: {total} में से {free} सीटें खाली, {price}',
  'Hide passengers': 'यात्री छिपाएँ',
  'Show passengers': 'यात्री दिखाएँ',
  'Nobody has booked this ride yet.': 'अभी तक किसी ने यह सवारी बुक नहीं की है।',
  '{from} → {to} · boards {time} · {n} seat · {price}': '{from} → {to} · {time} पर सवार · {n} सीट · {price}',
  '{from} → {to} · boards {time} · {n} seats · {price}': '{from} → {to} · {time} पर सवार · {n} सीटें · {price}',
  Accept: 'स्वीकार करें',
  Decline: 'अस्वीकार करें',
  'Yes, mark as no-show': 'हाँ, अनुपस्थित दर्ज करें',

  // Earnings
  'Trip completed': 'यात्रा पूरी हुई',
  'Passenger did not board': 'यात्री सवार नहीं हुआ',
  'Passenger cancelled late': 'यात्री ने देर से रद्द किया',
  Paid: 'भुगतान की तारीख',
  Why: 'कारण',
  Amount: 'राशि',

  // Notifications
  'Mark all as read': 'सभी को पढ़ा हुआ करें',
  'You have no notifications.': 'आपके पास कोई सूचना नहीं है।',
  'Unread:': 'अपठित:',
  'Mark as read': 'पढ़ा हुआ करें',

  // Search and booking
  'Board here: {stop}': 'यहाँ सवार हों: {stop}',
  'Get off here: {stop}': 'यहाँ उतरें: {stop}',
  'Map of the ride through {stops}': '{stops} से होकर जाने वाली सवारी का नक्शा',
  'Board at {stop}, leaving {time}.': '{stop} पर सवार हों, प्रस्थान {time}।',
  'The whole ride is {km} km by road.': 'पूरी सवारी सड़क से {km} किमी की है।',
  'The whole ride is about {km} km in a straight line; the road distance is not available.':
    'पूरी सवारी सीधी रेखा में लगभग {km} किमी की है; सड़क की दूरी उपलब्ध नहीं है।',
  'Your start': 'आपका शुरुआती स्थान',
  'Your destination': 'आपका गंतव्य',
  'Start: the centre of {town}': 'शुरुआत: {town} का केंद्र',
  'Destination: the centre of {town}': 'गंतव्य: {town} का केंद्र',
  'Start: a point you chose ({lat}, {lon})': 'शुरुआत: आपका चुना हुआ स्थान ({lat}, {lon})',
  'Destination: a point you chose ({lat}, {lon})': 'गंतव्य: आपका चुना हुआ स्थान ({lat}, {lon})',
  'Use the centre of {town} instead': 'इसके बजाय {town} का केंद्र लें',
  From: 'कहाँ से',
  To: 'कहाँ तक',
  Date: 'तारीख',
  'Rides are matched to the centre of each town unless you choose an exact point. Only rides with a stop near each end, or whose driver will come to your start, are shown.':
    'जब तक आप कोई सटीक स्थान नहीं चुनते, सवारियाँ हर शहर के केंद्र के अनुसार मिलाई जाती हैं। केवल वे सवारियाँ दिखाई जाती हैं जिनका पड़ाव दोनों सिरों के पास हो, या जिनका चालक आपकी शुरुआत की जगह पर आएगा।',
  'Hide the map': 'नक्शा छिपाएँ',
  'Choose exact points on a map': 'नक्शे पर सटीक स्थान चुनें',
  'Which point a click on the map sets': 'नक्शे पर क्लिक करने से कौन-सा स्थान तय होगा',
  'A click sets my start': 'क्लिक से मेरा शुरुआती स्थान तय हो',
  'A click sets my destination': 'क्लिक से मेरा गंतव्य तय हो',
  'Booked. {from} to {to}, leaving {time}.': 'बुक हो गई। {from} से {to}, प्रस्थान {time}।',
  'Request sent. Your seats are held while the driver decides; see My bookings.':
    'अनुरोध भेज दिया गया। चालक के निर्णय तक आपकी सीटें रोककर रखी गई हैं; "मेरी बुकिंग" देखें।',
  'Search results': 'खोज के परिणाम',
  'No rides have a stop near both ends on that day with that many seats. Try another date or other points.':
    'उस दिन, उतनी सीटों के साथ, ऐसी कोई सवारी नहीं है जिसका पड़ाव दोनों सिरों के पास हो। कोई दूसरी तारीख या दूसरे स्थान आज़माएँ।',
  'Sort by': 'क्रम',
  'Earliest departure': 'सबसे पहले प्रस्थान',
  'Lowest price': 'सबसे कम कीमत',
  'Best-rated driver': 'सबसे अच्छी रेटिंग वाला चालक',
  'Nearest pickup': 'सबसे पास का पिकअप',
  UPI: 'UPI',
  '{n} seat left': '{n} सीट बची है',
  '{n} seats left': '{n} सीटें बची हैं',
  'Confirms instantly': 'तुरंत पक्की होती है',
  'Driver approves each request': 'चालक हर अनुरोध को स्वीकार करता है',
  Book: 'बुक करें',
  Request: 'अनुरोध करें',
  'Hide route': 'मार्ग छिपाएँ',
  'Show route': 'मार्ग दिखाएँ',
  'You have no bookings yet.': 'आपकी अभी तक कोई बुकिंग नहीं है।',
  'Leaves {time} · {n} seat': 'प्रस्थान {time} · {n} सीट',
  'Leaves {time} · {n} seats': 'प्रस्थान {time} · {n} सीटें',
  'Fare {amount}': 'किराया {amount}',
  'Hide meeting point': 'मिलने का स्थान छिपाएँ',
  'Show meeting point': 'मिलने का स्थान दिखाएँ',
  'Cancel booking': 'बुकिंग रद्द करें',
  'Yes, cancel it': 'हाँ, रद्द करें',

  // Profile
  Member: 'सदस्य',
  'Driver since': 'चालक, इस समय से',
  'Passenger since': 'यात्री, इस समय से',
  'Completed trips': 'पूरी की गई यात्राएँ',
  Rating: 'रेटिंग',
  Reviews: 'समीक्षाएँ',
  'Nobody has written a review yet.': 'अभी तक किसी ने समीक्षा नहीं लिखी है।',
  '{stars} out of 5 · {reviewer} · {date}': '5 में से {stars} · {reviewer} · {date}',

  // Chat and live position
  'That message cannot be sent. Check it is not empty or too long.':
    'यह संदेश नहीं भेजा जा सकता। जाँचें कि यह खाली या बहुत लंबा न हो।',
  'The connection was lost. Close the chat and open it again.':
    'संपर्क टूट गया। चैट बंद करके फिर से खोलें।',
  'You are no longer on this ride.':
    'अब आप इस सवारी में शामिल नहीं हैं।',
  'You are sending messages too quickly. Wait a moment.':
    'आप बहुत तेज़ी से संदेश भेज रहे हैं। थोड़ी देर रुकें।',
  'Only the driver can share a position.':
    'केवल चालक ही अपना स्थान साझा कर सकता है।',
  'A position can only be shared while the ride is under way.':
    'स्थान केवल तभी साझा किया जा सकता है जब सवारी चल रही हो।',
  'That could not be sent. Try again.':
    'यह नहीं भेजा जा सका। फिर से कोशिश करें।',
  'The chat service cannot be reached. Try again.':
    'चैट सेवा से संपर्क नहीं हो पा रहा है। फिर से कोशिश करें।',
  'This device cannot report its position.':
    'यह डिवाइस अपना स्थान नहीं बता सकता।',
  'Your position is not available. Check that location access is allowed.':
    'आपका स्थान उपलब्ध नहीं है। जाँचें कि स्थान की अनुमति दी गई है।',
  'Your position cannot be found just now. Sharing stays on and carries on once it is found.':
    'आपका स्थान अभी नहीं मिल रहा है। साझा करना चालू रहेगा और स्थान मिलते ही फिर से शुरू होगा।',
  'Stop sharing my position':
    'मेरा स्थान साझा करना बंद करें',
  'Share my position with passengers':
    'यात्रियों के साथ मेरा स्थान साझा करें',
  'Passengers on this ride can see where you are until you stop or the ride ends.':
    'जब तक आप बंद नहीं करते या सवारी समाप्त नहीं होती, इस सवारी के यात्री देख सकते हैं कि आप कहाँ हैं।',
  'Connecting…':
    'जुड़ रहा है…',
  'The chat is only for the driver and passengers booked on this ride.':
    'चैट केवल चालक और इस सवारी में बुकिंग वाले यात्रियों के लिए है।',
  "The driver's position at {time}":
    '{time} पर चालक का स्थान',
  'The driver':
    'चालक',
  "Map showing the driver's last known position":
    'चालक का अंतिम ज्ञात स्थान दिखाने वाला नक्शा',
  'Messages':
    'संदेश',
  'No messages yet.':
    'अभी कोई संदेश नहीं है।',
  'You':
    'आप',
  'Message everyone on this ride':
    'इस सवारी के सभी लोगों को संदेश भेजें',
  'Send':
    'भेजें',
  'Open chat':
    'चैट खोलें',
  'Close chat':
    'चैट बंद करें',
  // Account, verification and emergencies
  'My account':
    'मेरा खाता',
  'Emergency':
    'आपातकाल',
  'Emergencies':
    'आपात स्थितियाँ',
  'If you are in danger, call 112 now.':
    'अगर आप खतरे में हैं, तो अभी 112 पर कॉल करें।',
  'Call 112':
    '112 पर कॉल करें',
  'You can also alert the VAYORA administrators. They see it in a queue; they are not an emergency service.':
    'आप VAYORA के व्यवस्थापकों को भी सूचित कर सकते हैं। उन्हें यह एक सूची में दिखता है; वे आपातकालीन सेवा नहीं हैं।',
  'Send an alert':
    'चेतावनी भेजें',
  'Close':
    'बंद करें',
  'Your alert is recorded and the administrators can see it.':
    'आपकी चेतावनी दर्ज हो गई है और व्यवस्थापक उसे देख सकते हैं।',
  'A message was sent to {n} of your emergency contacts.':
    'आपके {n} आपातकालीन संपर्कों को संदेश भेजा गया।',
  'Text messages are simulated in this project: your emergency contacts were NOT messaged. Call them yourself, or call 112.':
    'इस प्रोजेक्ट में SMS केवल सिम्युलेटेड हैं: आपके आपातकालीन संपर्कों को संदेश नहीं भेजा गया। उन्हें खुद कॉल करें, या 112 पर कॉल करें।',
  'Prefers a quiet ride':
    'शांत सफर पसंद है',
  'Happy with some conversation':
    'थोड़ी बातचीत ठीक है',
  'Likes to talk':
    'बात करना पसंद है',
  'Fine with smoking':
    'धूम्रपान से आपत्ति नहीं',
  'No smoking':
    'धूम्रपान नहीं',
  'Fine with pets':
    'पालतू जानवरों से आपत्ति नहीं',
  'No pets':
    'पालतू जानवर नहीं',
  'Likes music on the way':
    'रास्ते में संगीत पसंद है',
  'Prefers no music':
    'संगीत के बिना सफर पसंद है',
  'About this member':
    'इस सदस्य के बारे में',
  'About {n} years old':
    'लगभग {n} वर्ष',
  'Email confirmed':
    'ईमेल की पुष्टि हुई',
  'Phone confirmed':
    'फ़ोन की पुष्टि हुई',
  'VAYORA has not checked any identity documents.':
    'VAYORA ने किसी पहचान पत्र की जाँच नहीं की है।',
  'Enter 10 to 15 digits, with or without a + in front':
    '10 से 15 अंक लिखें, आगे + के साथ या उसके बिना',
  'Not said':
    'नहीं बताया',
  'Fine with me':
    'मुझे आपत्ति नहीं',
  'No, please':
    'कृपया नहीं',
  'Your profile is saved.':
    'आपकी प्रोफ़ाइल सहेज ली गई है।',
  'Phone number':
    'फ़ोन नंबर',
  'Never shown to other members. Changing it means confirming it again.':
    'दूसरे सदस्यों को कभी नहीं दिखाया जाता। इसे बदलने पर फिर से पुष्टि करनी होगी।',
  'About you':
    'अपने बारे में',
  'Year of birth':
    'जन्म का वर्ष',
  'Other members see only your approximate age.':
    'दूसरे सदस्यों को केवल आपकी अनुमानित उम्र दिखती है।',
  'Gender':
    'लिंग',
  'Woman':
    'महिला',
  'Man':
    'पुरुष',
  'Other':
    'अन्य',
  'Smoking in the car':
    'गाड़ी में धूम्रपान',
  'Pets in the car':
    'गाड़ी में पालतू जानवर',
  'Music on the way':
    'रास्ते में संगीत',
  'Conversation':
    'बातचीत',
  'I prefer a quiet ride':
    'मुझे शांत सफर पसंद है',
  'Some conversation is nice':
    'थोड़ी बातचीत अच्छी लगती है',
  'I like to talk':
    'मुझे बात करना पसंद है',
  'Saving…':
    'सहेजा जा रहा है…',
  'Save profile':
    'प्रोफ़ाइल सहेजें',
  'None given':
    'नहीं दिया गया',
  'Not confirmed':
    'पुष्टि नहीं हुई',
  'Send me a code':
    'मुझे कोड भेजें',
  '6-digit code':
    '6 अंकों का कोड',
  'Confirm':
    'पुष्टि करें',
  'This project sends no real email or SMS. The code was only written to the simulated outbox, which an administrator can read.':
    'यह प्रोजेक्ट कोई असली ईमेल या SMS नहीं भेजता। कोड केवल सिम्युलेटेड आउटबॉक्स में लिखा गया है, जिसे व्यवस्थापक पढ़ सकता है।',
  'The people the emergency button is meant to tell. Text messages are simulated in this project, so today they would NOT be messaged.':
    'वे लोग जिन्हें आपातकालीन बटन से सूचना मिलनी चाहिए। इस प्रोजेक्ट में SMS सिम्युलेटेड हैं, इसलिए आज उन्हें संदेश नहीं जाएगा।',
  'You have no emergency contacts yet.':
    'आपका अभी कोई आपातकालीन संपर्क नहीं है।',
  'Remove {name}':
    '{name} को हटाएँ',
  'Yes, remove':
    'हाँ, हटाएँ',
  'You can have at most {n} emergency contacts.':
    'आप अधिकतम {n} आपातकालीन संपर्क रख सकते हैं।',
  'Their name':
    'उनका नाम',
  'Their phone number':
    'उनका फ़ोन नंबर',
  'Who they are to you (optional)':
    'आपसे उनका रिश्ता (वैकल्पिक)',
  'Add contact':
    'संपर्क जोड़ें',
  'Profile':
    'प्रोफ़ाइल',
  'Email and phone':
    'ईमेल और फ़ोन',
  'Phone':
    'फ़ोन',
  'Emergency contacts':
    'आपातकालीन संपर्क',
  'Simulated outbox':
    'सिम्युलेटेड आउटबॉक्स',
  'None of these was sent to anyone. The newest 50 are kept in memory and are lost when the server restarts.':
    'इनमें से कोई भी किसी को नहीं भेजा गया। सबसे नए 50 मेमोरी में रखे जाते हैं और सर्वर दोबारा शुरू होने पर मिट जाते हैं।',
  'Nothing has been handed to the simulated sender.':
    'सिम्युलेटेड प्रेषक को अभी कुछ नहीं दिया गया है।',
  'Members who pressed the emergency button, oldest first. Acknowledging one records that you have seen it and are acting on it.':
    'वे सदस्य जिन्होंने आपातकालीन बटन दबाया, सबसे पुराने पहले। स्वीकार करने पर दर्ज होता है कि आपने इसे देखा है और कार्रवाई कर रहे हैं।',
  'No emergency is waiting.':
    'कोई आपात स्थिति प्रतीक्षा में नहीं है।',
  'Phone: {phone}':
    'फ़ोन: {phone}',
  'No phone number on the account.':
    'खाते में कोई फ़ोन नंबर नहीं है।',
  'Position given: {lat}, {lon}':
    'दी गई स्थिति: {lat}, {lon}',
  'No position was given.':
    'कोई स्थिति नहीं दी गई।',
  'On ride {id}':
    'सवारी {id} पर',
  '{n} emergency contacts on file. They were NOT messaged: the sender is simulated.':
    '{n} आपातकालीन संपर्क दर्ज हैं। उन्हें संदेश नहीं भेजा गया: प्रेषक सिम्युलेटेड है।',
  'A message was sent to {n} emergency contacts.':
    '{n} आपातकालीन संपर्कों को संदेश भेजा गया।',
  'Acknowledge':
    'स्वीकार करें',
  // Search filters
  'Hide filters':
    'फ़िल्टर छिपाएँ',
  'Filters':
    'फ़िल्टर',
  'Show only rides that':
    'केवल वे सवारियाँ दिखाएँ जो',
  'Leave in the':
    'इस समय निकलती हैं',
  'Any time of day':
    'दिन में किसी भी समय',
  'Morning, before 12':
    'सुबह, 12 बजे से पहले',
  'Afternoon, 12 to 5':
    'दोपहर, 12 से 5 बजे',
  'Evening, from 5':
    'शाम, 5 बजे से',
  'Cost at most, per seat (₹)':
    'प्रति सीट अधिकतम कीमत (₹)',
  'Confirm instantly':
    'तुरंत कन्फ़र्म होती हैं',
  'Have a driver with a confirmed email or phone':
    'जिनके चालक का ईमेल या फ़ोन पुष्ट है',
  'Have a driver who said no smoking':
    'जिनके चालक ने धूम्रपान के लिए मना किया है',
  'Have a driver who said pets are welcome':
    'जिनके चालक ने पालतू जानवरों को अनुमति दी है',
  'The last two leave out drivers who have not said either way. Filters apply when you press Search.':
    'आख़िरी दो फ़िल्टर उन चालकों को हटा देते हैं जिन्होंने कुछ नहीं बताया। फ़िल्टर खोजें दबाने पर लागू होते हैं।',
  'No rides match on that day with those filters. Try fewer filters, another date or other points.':
    'उस दिन इन फ़िल्टरों के साथ कोई सवारी नहीं मिली। कम फ़िल्टर, दूसरी तारीख या दूसरे स्थान आज़माएँ।',
  'Contact confirmed':
    'संपर्क की पुष्टि हुई',
  // Ride notes, return and repeated rides
  'At most 500 characters':
    'अधिकतम 500 अक्षर',
  'The return must leave after you have arrived':
    'वापसी आपके पहुँचने के बाद ही निकल सकती है',
  'I promise at most two passengers on the back seat':
    'मैं वादा करता/करती हूँ कि पिछली सीट पर अधिकतम दो यात्री होंगे',
  'Notes for passengers (optional)':
    'यात्रियों के लिए सूचना (वैकल्पिक)',
  'Luggage, where exactly you wait, anything they should know.':
    'सामान, आप ठीक कहाँ इंतज़ार करेंगे, जो भी उन्हें जानना चाहिए।',
  'Return ride leaving at (optional)':
    'वापसी की सवारी का समय (वैकल्पिक)',
  'The same stops in reverse, with the same prices and the same time between stops.':
    'वही पड़ाव उल्टे क्रम में, वही कीमतें और पड़ावों के बीच वही समय।',
  'Repeat every week':
    'हर हफ़्ते दोहराएँ',
  'At the same time of day. Each is a separate ride you can withdraw on its own.':
    'दिन के उसी समय। हर एक अलग सवारी है जिसे आप अलग से वापस ले सकते हैं।',
  'No, just this once':
    'नहीं, केवल इस बार',
  'For {n} more week':
    '{n} और हफ़्ते के लिए',
  'For {n} more weeks':
    '{n} और हफ़्तों के लिए',
  'This will publish {n} rides.':
    'इससे {n} सवारियाँ प्रकाशित होंगी।',
  'At most two in the back':
    'पीछे अधिकतम दो यात्री',
  'Promise at most two in the back':
    'पीछे अधिकतम दो यात्रियों का वादा करती हैं',
  'From the driver:':
    'चालक की ओर से:',
  // Vehicle details
  'Basic':
    'साधारण',
  'Comfortable':
    'आरामदायक',
  'Premium':
    'प्रीमियम',
  'No luggage':
    'सामान नहीं',
  'A small bag each':
    'हर यात्री एक छोटा बैग',
  'A medium bag each':
    'हर यात्री एक मध्यम बैग',
  'A large suitcase each':
    'हर यात्री एक बड़ा सूटकेस',
  'Electric':
    'इलेक्ट्रिक',
  'Between 1 and 300 kWh':
    '1 से 300 kWh के बीच',
  'Between 5 and 60 kWh per 100 km':
    'प्रति 100 किमी 5 से 60 kWh के बीच',
  'About {km} km on a full charge, from the figures you gave. Not a measured range.':
    'आपके दिए आँकड़ों के अनुसार पूरी चार्जिंग पर लगभग {km} किमी। यह मापी गई रेंज नहीं है।',
  'Comfort (optional)':
    'आराम का स्तर (वैकल्पिक)',
  'Your own description. Nobody inspects the car.':
    'यह आपका अपना विवरण है। गाड़ी की कोई जाँच नहीं करता।',
  'Luggage per passenger (optional)':
    'प्रति यात्री सामान (वैकल्पिक)',
  'This vehicle is electric':
    'यह वाहन इलेक्ट्रिक है',
  'Battery (kWh, optional)':
    'बैटरी (kWh, वैकल्पिक)',
  'Consumption (kWh per 100 km, optional)':
    'खपत (kWh प्रति 100 किमी, वैकल्पिक)',
  // Seat holds
  'Hold while I decide':
    'सोचने तक रोककर रखें',
  'Held for you until {time}. This is not a booking: book before then or the seats go back.':
    '{time} तक आपके लिए रोकी गई हैं। यह बुकिंग नहीं है: उससे पहले बुक करें, नहीं तो सीटें वापस चली जाएँगी।',
  // Passenger payments
  'Payments':
    'भुगतान',
  'Payments, newest first':
    'भुगतान, सबसे नए पहले',
  'Booked':
    'बुकिंग का समय',
  // Women-only rides
  'Women passengers only':
    'केवल महिला यात्री',
  'A ride for women passengers only can be offered by a driver whose profile says she is a woman.':
    'केवल महिला यात्रियों के लिए सवारी वही चालक दे सकती है जिसकी प्रोफ़ाइल में लिखा हो कि वह महिला है।',
  'Women only':
    'केवल महिलाएँ',
  'Are for women only':
    'केवल महिलाओं के लिए हैं',
  'Not shown on your profile. Choosing Woman lets you offer and book women-only rides; nobody checks it.':
    'आपकी प्रोफ़ाइल पर नहीं दिखाया जाता। महिला चुनने पर आप केवल-महिला सवारियाँ दे और बुक कर सकती हैं; इसकी कोई जाँच नहीं करता।',
  // Travel passes
  '{n} days':
    '{n} दिन',
  // Receipts
  'Download receipt (PDF, in English)':
    'रसीद डाउनलोड करें (PDF, अंग्रेज़ी में)',
  'The receipt could not be downloaded. Try again.':
    'रसीद डाउनलोड नहीं हो सकी। फिर से कोशिश करें।',
  'Receipt':
    'रसीद',
  'View or print receipt':
    'रसीद देखें या प्रिंट करें',
  'Receipt for booking {id}':
    'बुकिंग {id} की रसीद',
  '{from} to {to}, {n} seat':
    '{from} से {to}, {n} सीट',
  '{from} to {to}, {n} seats':
    '{from} से {to}, {n} सीटें',
  'Boarding':
    'सवार होने का समय',
  'Booking status':
    'बुकिंग की स्थिति',
  '{when}, by {method}':
    '{when}, {method} से',
  'Fare':
    'किराया',
  'This is not a tax invoice.':
    'यह कर बीजक (टैक्स इनवॉइस) नहीं है।',
  'Times are India Standard Time.':
    'समय भारतीय मानक समय (IST) में हैं।',
  'Print or save as PDF':
    'प्रिंट करें या PDF के रूप में सहेजें',
  'To keep a copy, choose to save as PDF instead of a printer.':
    'प्रति रखने के लिए, प्रिंटर की जगह PDF के रूप में सहेजना चुनें।',
  // Durability explanations
  'How far ahead it was booked':
    'कितने पहले बुक किया गया',
  'Seats booked':
    'बुक की गई सीटें',
  'Hour the ride leaves':
    'सवारी निकलने का समय',
  'Gap from the time asked for':
    'चाहे गए समय से अंतर',
  'Earlier accepted bookings':
    'पहले स्वीकार की गई बुकिंग',
  'Earlier cancellations':
    'पहले के रद्दीकरण',
  'Earlier completed trips':
    'पहले पूरी की गई यात्राएँ',
  'Earlier no-shows':
    'पहले न पहुँचना',
  'Share of earlier bookings cancelled':
    'पहले की बुकिंग में रद्द का हिस्सा',
  'Main reasons':
    'मुख्य कारण',
  '{factor} makes a cancellation likelier':
    '{factor} से रद्द होने की संभावना बढ़ती है',
  '{factor} makes a cancellation less likely':
    '{factor} से रद्द होने की संभावना घटती है',
  // Driver response rate
  'Answers requests':
    'अनुरोधों का जवाब देता है',
  'Not enough requests yet':
    'अभी पर्याप्त अनुरोध नहीं',
  '{rate}, usually within {time}':
    '{rate}, आमतौर पर {time} के भीतर',
  // Boarding codes
  'Reference {reference}. Boarding code':
    'संदर्भ {reference}। बोर्डिंग कोड',
  'Show the code to the driver when you board.':
    'सवार होते समय यह कोड चालक को दिखाएँ।',
  'Show my boarding code':
    'मेरा बोर्डिंग कोड दिखाएँ',
  'Boarding code shown by the passenger':
    'यात्री द्वारा दिखाया गया बोर्डिंग कोड',
  'Code':
    'कोड',
  'Check code':
    'कोड जाँचें',
  'Matches this booking':
    'इस बुकिंग से मेल खाता है',
  'Does not match this booking':
    'इस बुकिंग से मेल नहीं खाता',
  // After the trip
  'Thank you for confirming.':
    'पुष्टि करने के लिए धन्यवाद।',
  'Thank you. An administrator will look into it; nothing has been changed yet.':
    'धन्यवाद। एक व्यवस्थापक इसकी जाँच करेगा; अभी कुछ भी बदला नहीं गया है।',
  'The driver marked this trip completed. Did it happen?':
    'चालक ने इस यात्रा को पूरा बताया है। क्या यह हुई?',
  'Yes, I travelled':
    'हाँ, मैंने यात्रा की',
  'No, it did not happen':
    'नहीं, यह नहीं हुई',
  '{n} completed trips are disputed by their passenger.':
    '{n} पूरी यात्राओं पर उनके यात्री ने आपत्ति की है।',
  'See them':
    'देखें',
  'Disputed trips':
    'विवादित यात्राएँ',
  'Trips a driver marked completed and the passenger says did not happen. Nothing has been reversed: payments are simulated, and each case is for a person to judge.':
    'वे यात्राएँ जिन्हें चालक ने पूरा बताया और यात्री कहता है कि नहीं हुईं। कुछ भी उलटा नहीं गया है: भुगतान सिम्युलेटेड हैं, और हर मामले का निर्णय किसी व्यक्ति को करना है।',
  'No trip is disputed.':
    'कोई यात्रा विवादित नहीं है।',
  'driver':
    'चालक',
  'disputed {time}':
    '{time} को आपत्ति',
  // More search filters
  'Cost at least, per seat (₹)':
    'प्रति सीट न्यूनतम कीमत (₹)',
  'Comfort at least':
    'न्यूनतम आराम',
  'Any':
    'कोई भी',
  'Room for luggage, at least':
    'सामान के लिए न्यूनतम जगह',
  'Have a driver who likes music on the way':
    'जिनके चालक को रास्ते में संगीत पसंद है',
  'Have a driver who prefers a quiet ride':
    'जिनके चालक को शांत सफर पसंद है',
  // Levels and the driver record
  'Newcomer':
    'नया सदस्य',
  'Intermediate':
    'मध्यम',
  'Experienced':
    'अनुभवी',
  'Expert':
    'विशेषज्ञ',
  'Ambassador':
    'राजदूत',
  'Level':
    'स्तर',
  'My record':
    'मेरा रिकॉर्ड',
  'Rides completed':
    'पूरी की गई सवारियाँ',
  'Rides you withdrew':
    'आपके द्वारा वापस ली गई सवारियाँ',
  'Passengers carried':
    'ले जाए गए यात्री',
  'Passengers whose booking you cancelled':
    'यात्री जिनकी बुकिंग आपने रद्द की',
  'Passengers you marked as not boarding':
    'यात्री जिन्हें आपने न पहुँचा बताया',
  'Only you see this page. Passengers see your level, rating, completed trips and how you answer requests.':
    'यह पेज केवल आप देखते हैं। यात्री आपका स्तर, रेटिंग, पूरी यात्राएँ और अनुरोधों का जवाब देना देखते हैं।',
  // Notification preferences
  'You always see notifications here. You can also have a copy sent to a confirmed email address or phone. In this project no email or SMS is really sent: copies go to the simulated outbox.':
    'आप सूचनाएँ हमेशा यहाँ देखते हैं। आप पुष्ट ईमेल पते या फ़ोन पर इनकी प्रति भी मँगा सकते हैं। इस प्रोजेक्ट में कोई ईमेल या SMS सच में नहीं भेजा जाता: प्रतियाँ सिम्युलेटेड आउटबॉक्स में जाती हैं।',
  'Email me a copy':
    'मुझे ईमेल पर प्रति भेजें',
  'Text me a copy':
    'मुझे SMS पर प्रति भेजें',
  'Confirm your email address above, or no copy can be sent.':
    'ऊपर अपने ईमेल पते की पुष्टि करें, नहीं तो कोई प्रति नहीं भेजी जा सकती।',
  'Confirm your phone number above, or no copy can be sent.':
    'ऊपर अपने फ़ोन नंबर की पुष्टि करें, नहीं तो कोई प्रति नहीं भेजी जा सकती।',
  // Series and back-office browsing
  'Cancel every ride in this series':
    'इस शृंखला की सभी सवारियाँ रद्द करें',
  'Yes, cancel them all':
    'हाँ, सभी रद्द करें',
  'Rides':
    'सवारियाँ',
  'Bookings':
    'बुकिंग',
  'Status':
    'स्थिति',
  'No rides.':
    'कोई सवारी नहीं।',
  'No bookings.':
    'कोई बुकिंग नहीं।',
  '{n} seats offered, {b} bookings':
    '{n} सीटें उपलब्ध, {b} बुकिंग',
  'with {driver}, {n} seats':
    '{driver} के साथ, {n} सीटें',
  // Referral
  'Invitation code (optional)':
    'आमंत्रण कोड (वैकल्पिक)',
  'Invite friends':
    'दोस्तों को आमंत्रित करें',
  'Your invitation code':
    'आपका आमंत्रण कोड',
  '{n} signed up with it; {q} of them have completed a trip.':
    'इससे {n} ने साइन अप किया; उनमें से {q} ने यात्रा पूरी की है।',
  // Bus services
  'Buses instead':
    'इसके बजाय बसें',
  'Listed by VAYORA staff, not by the bus operator. Check times and fares with the operator before you travel.':
    'VAYORA कर्मचारियों द्वारा सूचीबद्ध, बस संचालक द्वारा नहीं। यात्रा से पहले समय और किराया संचालक से जाँच लें।',
  'about {hours} h':
    'लगभग {hours} घंटे',
  'Bus services':
    'बस सेवाएँ',
  'Passengers see these when no ride matches their search, and in the notice when a driver withdraws. Enter them from the operator\'s published timetable: nothing here checks them, and passengers are told to check with the operator.':
    'जब कोई सवारी खोज से मेल नहीं खाती, और जब चालक सवारी वापस लेता है, तब यात्रियों को ये दिखती हैं। इन्हें संचालक की प्रकाशित समय-सारणी से दर्ज करें: यहाँ इनकी जाँच नहीं होती, और यात्रियों को संचालक से जाँचने को कहा जाता है।',
  'Operator':
    'संचालक',
  'Leaves at':
    'रवाना होने का समय',
  'Journey time in minutes':
    'यात्रा का समय (मिनट)',
  'Fare in rupees':
    'किराया (रुपये)',
  'Notes (optional)':
    'टिप्पणी (वैकल्पिक)',
  'Add bus service':
    'बस सेवा जोड़ें',
  'No bus services are listed.':
    'कोई बस सेवा सूचीबद्ध नहीं है।',
  'Remove':
    'हटाएँ',
  'Yes, remove it':
    'हाँ, हटाएँ',
  // Electric range
  'This route is longer than the {range} km your vehicle covers on a full charge, by your own figures. Plan a charging stop: VAYORA does not plan one for you.':
    'यह मार्ग आपके अपने आँकड़ों के अनुसार पूरी चार्ज पर आपके वाहन की {range} किमी की दूरी से लंबा है। चार्जिंग के लिए रुकने की योजना बनाएँ: VAYORA आपके लिए यह योजना नहीं बनाता।',
  // Phone sign-up
  'Enter your email or phone number':
    'अपना ईमेल या फ़ोन नंबर दर्ज करें',
  'Enter a valid email or phone number':
    'मान्य ईमेल या फ़ोन नंबर दर्ज करें',
  'Email or phone number':
    'ईमेल या फ़ोन नंबर',
  'Sign in with':
    'किससे साइन इन करेंगे',
  'You will be asked to confirm it with a code. In this project no SMS is really sent.':
    'आपसे एक कोड से इसकी पुष्टि करने को कहा जाएगा। इस परियोजना में कोई SMS वास्तव में नहीं भेजा जाता।',
  'Signed up by phone':
    'फ़ोन से साइन अप किया',
  // What-if explorer
  'What if':
    'क्या होगा अगर',
  'Question':
    'प्रश्न',
  'How many reconfirmation requests may go out at once':
    'एक बार में कितने पुनःपुष्टि अनुरोध भेजे जा सकते हैं',
  'How far from their chosen time passengers will travel':
    'यात्री अपने चुने समय से कितना हटकर यात्रा करेंगे',
  'How early drivers publish their rides':
    'चालक अपनी सवारियाँ कितनी पहले प्रकाशित करते हैं',
  'Requests per round':
    'प्रति दौर अनुरोध',
  'Hours either side of the chosen time':
    'चुने समय के दोनों ओर घंटे',
  'Days ahead, at the least, that a ride is published':
    'सवारी कम से कम कितने दिन पहले प्रकाशित होती है',
  'Completed rides per 100 searches':
    'प्रति 100 खोजों पर पूरी हुई सवारियाँ',
  'Late share of cancellations':
    'रद्दीकरणों में देर से हुए का हिस्सा',
  'Reconfirmation requests per accepted booking':
    'प्रति स्वीकृत बुकिंग पुनःपुष्टि अनुरोध',
  'Released seats refilled':
    'छोड़ी गई सीटें फिर से भरीं',
  'Refills by a passenger offered no other ride':
    'ऐसे यात्री द्वारा भराव जिसे कोई और सवारी नहीं मिली',
  'Searches offered no ride':
    'खोजें जिनमें कोई सवारी नहीं मिली',
  '{variant} compared with {baseline}, {seeds} seeds each, paired by seed.':
    '{variant} की तुलना {baseline} से, प्रत्येक के {seeds} सीड, सीड के अनुसार जोड़े गए।',
  'The baseline was run on the same changed world.':
    'आधार रेखा उसी बदली हुई दुनिया पर चलाई गई।',
  'The baseline was run once, on the unchanged world.':
    'आधार रेखा एक बार, बिना बदली दुनिया पर चलाई गई।',
  'Measure':
    'माप',
  'Difference (95% interval)':
    'अंतर (95% अंतराल)',
  'to':
    'से',
  'no clear difference':
    'कोई स्पष्ट अंतर नहीं',
  'Run {run}. Rebuilt and checked by scripts/reproduce.sh.':
    'रन {run}। scripts/reproduce.sh द्वारा दोबारा बनाया और जाँचा गया।',
  // What-if: threshold sweep
  'How risky a booking must look before its passenger is asked':
    'यात्री से पूछने से पहले बुकिंग कितनी जोखिम भरी दिखनी चाहिए',
  'Ask when the estimated chance of lasting to departure is below':
    'पूछें जब प्रस्थान तक टिकने की अनुमानित संभावना इससे कम हो',
  // What-if: oracle sweep
  'The most asking could gain, by how readily passengers release':
    'पूछने से अधिकतम कितना लाभ, यात्री कितनी आसानी से सीट छोड़ते हैं उसके अनुसार',
  'Chance an asked passenger releases at once':
    'पूछे गए यात्री के तुरंत सीट छोड़ने की संभावना',
  // Rest stops and chargers
  'Chargers are listed near this route below.':
    'इस मार्ग के पास के चार्जर नीचे दिए गए हैं।',
  'No charger is listed near this route.':
    'इस मार्ग के पास कोई चार्जर सूचीबद्ध नहीं है।',
  'Along this route':
    'इस मार्ग पर',
  'km {km}':
    'किमी {km}',
  'charger, {kw} kW':
    'चार्जर, {kw} kW',
  'charger':
    'चार्जर',
  'rest stop':
    'विश्राम स्थल',
  '{km} km off the route':
    'मार्ग से {km} किमी दूर',
  'a good place for a break':
    'विश्राम के लिए अच्छी जगह',
  'Listed by VAYORA staff. Nothing checks that a stop is open or a charger works.':
    'VAYORA कर्मचारियों द्वारा सूचीबद्ध। कोई जाँच नहीं करता कि स्थल खुला है या चार्जर काम करता है।',
  'Rest stops and chargers':
    'विश्राम स्थल और चार्जर',
  'Drivers see these when they work out a route that passes near them. Nothing here checks that a stop is open or a charger works, and drivers are told so.':
    'जब चालक पास से गुजरने वाला मार्ग बनाते हैं तो उन्हें ये दिखते हैं। यहाँ कोई जाँच नहीं होती कि स्थल खुला है या चार्जर काम करता है, और चालकों को यह बताया जाता है।',
  'Kind':
    'प्रकार',
  'Rest stop':
    'विश्राम स्थल',
  'Charger':
    'चार्जर',
  'Latitude':
    'अक्षांश',
  'Longitude':
    'देशांतर',
  'Power in kW (optional)':
    'शक्ति kW में (वैकल्पिक)',
  'Add':
    'जोड़ें',
  'No rest stops or chargers are listed.':
    'कोई विश्राम स्थल या चार्जर सूचीबद्ध नहीं है।',
  // Notifications
  '{passenger} booked {seats}.':
    '{passenger} ने {seats} बुक कीं।',
  '{passenger} asked for {seats}.':
    '{passenger} ने {seats} का अनुरोध किया।',
  'The driver accepted your booking for {seats}.':
    'चालक ने {seats} के लिए आपकी बुकिंग स्वीकार की।',
  '{passenger}\'s request for {seats} was closed because it was not answered in time.':
    '{passenger} का {seats} का अनुरोध समय पर उत्तर न मिलने से बंद कर दिया गया।',
  '{passenger} cancelled {seats}.':
    '{passenger} ने {seats} रद्द कीं।',
  '{n} seat, {from} to {to}':
    '{n} सीट, {from} से {to}',
  '{n} seats, {from} to {to}':
    '{n} सीटें, {from} से {to}',
  'Your trip from {from} to {to} is complete. You can rate your driver in My bookings.':
    '{from} से {to} तक आपकी यात्रा पूरी हुई। आप मेरी बुकिंग में अपने चालक को रेटिंग दे सकते हैं।',
  'No other ride with seats leaves near that time.':
    'उस समय के आसपास सीटों वाली कोई और सवारी नहीं है।',
  'No other ride with seats leaves near that time. Buses listed by VAYORA staff (check with the operator before travelling): {buses}.':
    'उस समय के आसपास सीटों वाली कोई और सवारी नहीं है। VAYORA कर्मचारियों द्वारा सूचीबद्ध बसें (यात्रा से पहले संचालक से जाँच लें): {buses}।',
  'Other rides that could take you: {rides}. Search again to book one.':
    'अन्य सवारियाँ जो आपको ले जा सकती हैं: {rides}। बुक करने के लिए फिर से खोजें।',
  '{time} from {stop} with {driver}':
    '{time}, {stop} से, {driver} के साथ',
  '{time} {operator}, Rs {fare}':
    '{time} {operator}, ₹ {fare}',
  'A passenger says a trip marked completed did not happen. See disputed trips.':
    'एक यात्री का कहना है कि पूरी बताई गई यात्रा हुई ही नहीं। विवादित यात्राएँ देखें।',
  'How was your trip with {driver}? You can still rate it.':
    '{driver} के साथ आपकी यात्रा कैसी रही? आप अब भी रेटिंग दे सकते हैं।',
  'How was {passenger} as a passenger? You can still rate the trip.':
    'यात्री के रूप में {passenger} कैसे रहे? आप अब भी यात्रा को रेटिंग दे सकते हैं।',
  'An administrator reviewed a report about you.':
    'एक व्यवस्थापक ने आपके बारे में एक रिपोर्ट की समीक्षा की।',
  'An administrator reviewed a report about you: {note}':
    'एक व्यवस्थापक ने आपके बारे में एक रिपोर्ट की समीक्षा की: {note}',
  '{name} pressed the emergency button. Open the emergency queue.':
    '{name} ने आपातकालीन बटन दबाया। आपातकालीन सूची खोलें।',
  // Photos
  'Choose a photo':
    'फ़ोटो चुनें',
  'Uploading…':
    'अपलोड हो रहा है…',
  'Replace photo':
    'फ़ोटो बदलें',
  'Add a photo':
    'फ़ोटो जोड़ें',
  'Remove photo':
    'फ़ोटो हटाएँ',
  'JPEG or PNG, up to 5 MB. It is stored resized, without the location or other details the file may carry.':
    'JPEG या PNG, अधिकतम 5 MB। इसे छोटा करके रखा जाता है, फ़ाइल में मौजूद स्थान या अन्य विवरण के बिना।',
  'Your photo':
    'आपकी फ़ोटो',
  'Photo of {name}':
    '{name} की फ़ोटो',
  'Photo of the {vehicle}':
    '{vehicle} की फ़ोटो',
  // Push
  'Notifications are blocked for this site in your browser settings.':
    'आपकी ब्राउज़र सेटिंग में इस साइट के लिए सूचनाएँ बंद हैं।',
  'This browser cannot receive push notifications.':
    'यह ब्राउज़र पुश सूचनाएँ प्राप्त नहीं कर सकता।',
  'Push notifications are not set up on this server.':
    'इस सर्वर पर पुश सूचनाएँ सेट नहीं हैं।',
  'Push notifications are on in this browser.':
    'इस ब्राउज़र में पुश सूचनाएँ चालू हैं।',
  'Push notifications are off in this browser.':
    'इस ब्राउज़र में पुश सूचनाएँ बंद हैं।',
  'Turn off in this browser':
    'इस ब्राउज़र में बंद करें',
  'Turn on in this browser':
    'इस ब्राउज़र में चालू करें',
  'A push shows the notification in English, as email and SMS copies do.':
    'पुश सूचना अंग्रेज़ी में दिखती है, जैसे ईमेल और SMS प्रतियाँ।',
  // Driver record and walk
  'about {minutes} min walk to the pickup, in a straight line':
    'पिकअप तक सीधी रेखा में लगभग {minutes} मिनट पैदल',
  'No completed rides yet':
    'अभी तक कोई सवारी पूरी नहीं की',
  'Completed {completed} of the {offered} rides they have finished or withdrawn':
    'पूरी या वापस ली गई {offered} सवारियों में से {completed} पूरी कीं',
  // Flexibility tiers
  'If the driver withdraws':
    'यदि चालक सवारी वापस ले',
  'Only this ride: suggest others':
    'केवल यही सवारी: अन्य सुझाएँ',
  'Flexible: book me within 2 hours':
    'लचीला: 2 घंटे के भीतर बुक करें',
  'Any time that day':
    'उस दिन कभी भी',
  'This driver has withdrawn some rides. A flexible booking would move you to another ride automatically.':
    'इस चालक ने कुछ सवारियाँ वापस ली हैं। लचीली बुकिंग आपको अपने आप दूसरी सवारी पर ले जाएगी।',
  'Already on the road: it may reach {stop} before the time shown, so be there early.':
    'सवारी पहले ही रास्ते में है: यह दिखाए गए समय से पहले {stop} पहुँच सकती है, इसलिए पहले पहुँचें।',
  'If the driver withdraws, you are booked on another ride within 2 hours.':
    'यदि चालक सवारी वापस लेता है, तो आपको 2 घंटे के भीतर दूसरी सवारी पर बुक किया जाएगा।',
  'If the driver withdraws, you are booked on another ride that day.':
    'यदि चालक सवारी वापस लेता है, तो आपको उसी दिन दूसरी सवारी पर बुक किया जाएगा।',
  'As you chose a flexible booking, you are booked on the {time} ride from {stop} with {driver}.':
    'आपने लचीली बुकिंग चुनी थी, इसलिए आपको {stop} से {time} की {driver} की सवारी पर बुक किया गया है।',
  'As you chose a flexible booking, you have asked for a seat on the {time} ride from {stop} with {driver}. The driver will answer.':
    'आपने लचीली बुकिंग चुनी थी, इसलिए {stop} से {time} की {driver} की सवारी पर आपकी ओर से सीट का अनुरोध किया गया है। चालक उत्तर देंगे।',
  'You chose a flexible booking, but no other ride with seats fits it. Nothing new has been booked.':
    'आपने लचीली बुकिंग चुनी थी, पर सीटों वाली कोई और सवारी इसमें नहीं बैठती। कुछ नया बुक नहीं किया गया है।',
  // Server messages
  'A bus must go somewhere else':
    'बस को किसी दूसरी जगह जाना चाहिए',
  'A code was sent a moment ago. Wait before asking for another.':
    'अभी-अभी एक कोड भेजा गया है। दूसरा माँगने से पहले रुकें।',
  'A no-show can only be recorded while the ride is in progress':
    'सवार न होना केवल सवारी चलते समय दर्ज किया जा सकता है',
  'A ride needs exactly one price per leg between stops':
    'सवारी में स्टॉप के बीच हर हिस्से की ठीक एक कीमत होनी चाहिए',
  'Add a phone number first':
    'पहले एक फ़ोन नंबर जोड़ें',
  'Administrators cannot self-register':
    'व्यवस्थापक स्वयं पंजीकरण नहीं कर सकते',
  'Battery and consumption are only for an electric vehicle':
    'बैटरी और खपत केवल इलेक्ट्रिक वाहन के लिए हैं',
  'Booking not found':
    'बुकिंग नहीं मिली',
  'Contact not found':
    'संपर्क नहीं मिला',
  'Departure time must be in the future':
    'प्रस्थान का समय भविष्य में होना चाहिए',
  'Email is already registered':
    'यह ईमेल पहले से पंजीकृत है',
  'Enter a phone number of 10 to 15 digits':
    '10 से 15 अंकों का फ़ोन नंबर दर्ज करें',
  'Give an email address or a phone number':
    'एक ईमेल पता या फ़ोन नंबर दें',
  'Invalid email, phone number or password':
    'ईमेल, फ़ोन नंबर या पासवर्ड गलत है',
  'It is too early to start this ride':
    'यह सवारी शुरू करने के लिए अभी बहुत जल्दी है',
  'Member not found':
    'सदस्य नहीं मिला',
  'No boarding pass for that booking':
    'उस बुकिंग का कोई बोर्डिंग पास नहीं है',
  'No open alert with that id':
    'उस आईडी का कोई खुला अलर्ट नहीं है',
  'No photo':
    'कोई फ़ोटो नहीं',
  'No receipt for that booking':
    'उस बुकिंग की कोई रसीद नहीं है',
  'No ride open for booking has those stops':
    'बुकिंग के लिए खुली किसी सवारी में ये स्टॉप नहीं हैं',
  'No such bus service':
    'ऐसी कोई बस सेवा नहीं है',
  'No such channel':
    'ऐसा कोई माध्यम नहीं है',
  'No such stopover':
    'ऐसा कोई पड़ाव नहीं है',
  'Not enough seats left on that part of the ride':
    'सवारी के उस हिस्से पर पर्याप्त सीटें नहीं बचीं',
  'Not enough seats left on that part of the ride to hold':
    'सवारी के उस हिस्से पर रोकने के लिए पर्याप्त सीटें नहीं बचीं',
  'Not enough seats left on that part of the ride: some are being held for another passenger for a few minutes':
    'सवारी के उस हिस्से पर पर्याप्त सीटें नहीं बचीं: कुछ सीटें कुछ मिनटों के लिए दूसरे यात्री के लिए रोकी गई हैं',
  'Notification not found':
    'सूचना नहीं मिली',
  'Only a charger has a power rating':
    'केवल चार्जर की शक्ति दर्ज होती है',
  'Only a completed trip can be confirmed':
    'केवल पूरी हुई यात्रा की पुष्टि की जा सकती है',
  'Only a completed trip can be rated':
    'केवल पूरी हुई यात्रा को रेटिंग दी जा सकती है',
  'Only a driver whose profile says she is a woman can offer a women-only ride. Set your gender on your account page first.':
    'केवल वही चालक महिलाओं के लिए सवारी दे सकती है जिसकी प्रोफ़ाइल में वह महिला हो। पहले अपने खाते के पृष्ठ पर अपना लिंग सेट करें।',
  'Only a ride in progress can be completed':
    'केवल चल रही सवारी को पूरा किया जा सकता है',
  'Only a scheduled ride can be cancelled':
    'केवल निर्धारित सवारी रद्द की जा सकती है',
  'Only a scheduled ride can be started':
    'केवल निर्धारित सवारी शुरू की जा सकती है',
  'Phone number is already registered':
    'यह फ़ोन नंबर पहले से पंजीकृत है',
  'Push notifications are not set up on this server':
    'इस सर्वर पर पुश सूचनाएँ सेट नहीं हैं',
  'Report not found':
    'रिपोर्ट नहीं मिली',
  'Request a code first':
    'पहले एक कोड माँगें',
  'Ride not found':
    'सवारी नहीं मिली',
  'Seats cannot be held right now. You can still book.':
    'अभी सीटें रोकी नहीं जा सकतीं। आप फिर भी बुक कर सकते हैं।',
  'Stops must be in travel order with increasing offsetMinutes':
    'स्टॉप यात्रा के क्रम में और बढ़ते offsetMinutes के साथ होने चाहिए',
  'That code has expired. Request a new one.':
    'उस कोड की अवधि समाप्त हो गई है। नया कोड माँगें।',
  'That code is no longer valid. Request a new one.':
    'वह कोड अब मान्य नहीं है। नया कोड माँगें।',
  'That code is not right':
    'वह कोड सही नहीं है',
  'That is not a photo VAYORA can read: use a JPEG or PNG':
    'VAYORA यह फ़ोटो नहीं पढ़ सकता: JPEG या PNG का उपयोग करें',
  'That is not a push service VAYORA sends to':
    'VAYORA इस पुश सेवा को नहीं भेजता',
  'That phone number belongs to another account':
    'वह फ़ोन नंबर किसी दूसरे खाते का है',
  'That photo has too many pixels':
    'उस फ़ोटो में बहुत अधिक पिक्सेल हैं',
  'That photo is too large':
    'वह फ़ोटो बहुत बड़ी है',
  'That referral code does not exist':
    'वह आमंत्रण कोड मौजूद नहीं है',
  'The browser\'s keys are not valid':
    'ब्राउज़र की कुंजियाँ मान्य नहीं हैं',
  'The earliest hour must be before the latest':
    'सबसे पहला घंटा सबसे आखिरी से पहले होना चाहिए',
  'The email could not be sent. Try again later.':
    'ईमेल नहीं भेजा जा सका। बाद में फिर कोशिश करें।',
  'The first stop must have offsetMinutes 0':
    'पहले स्टॉप का offsetMinutes 0 होना चाहिए',
  'The lowest price must not be above the highest':
    'सबसे कम कीमत सबसे अधिक से ऊपर नहीं होनी चाहिए',
  'The return must leave after the ride out has arrived':
    'वापसी जाने वाली सवारी के पहुँचने के बाद निकलनी चाहिए',
  'This account has no email address':
    'इस खाते में कोई ईमेल पता नहीं है',
  'This driver approves each request, and it is too close to departure for an answer. Choose a ride that confirms instantly.':
    'यह चालक हर अनुरोध स्वीकृत करता है, और उत्तर के लिए प्रस्थान बहुत करीब है। ऐसी सवारी चुनें जो तुरंत पुष्टि करती हो।',
  'This idempotency key was already used for a different booking':
    'यह idempotency key किसी दूसरी बुकिंग के लिए पहले ही उपयोग हो चुकी है',
  'This is already verified':
    'इसकी पुष्टि पहले ही हो चुकी है',
  'This report is already closed':
    'यह रिपोर्ट पहले ही बंद हो चुकी है',
  'This request was already submitted':
    'यह अनुरोध पहले ही भेजा जा चुका है',
  'This ride has already left that stop':
    'यह सवारी उस स्टॉप से पहले ही निकल चुकी है',
  'This ride has already left; the booking can no longer be cancelled':
    'यह सवारी निकल चुकी है; बुकिंग अब रद्द नहीं की जा सकती',
  'This ride is for women only':
    'यह सवारी केवल महिलाओं के लिए है',
  'This ride is not open for booking':
    'यह सवारी बुकिंग के लिए खुली नहीं है',
  'This ride is not part of a series with rides still to run':
    'यह सवारी ऐसी शृंखला का हिस्सा नहीं है जिसकी सवारियाँ अभी बाकी हों',
  'This ride is on the road and due at that stop too soon to book':
    'यह सवारी रास्ते में है और उस स्टॉप पर इतनी जल्दी पहुँचेगी कि बुकिंग नहीं हो सकती',
  'This ride is already on the road, and its driver approves each request':
    'यह सवारी पहले ही रास्ते में है, और इसका चालक हर अनुरोध को मंज़ूरी देता है',
  'That insurance has already ended':
    'वह बीमा पहले ही समाप्त हो चुका है',
  'A call can only be made while the booking is confirmed':
    'कॉल केवल तभी की जा सकती है जब बुकिंग पक्की हो',
  'It is too early to call: calls open shortly before the trip':
    'कॉल करने के लिए अभी बहुत जल्दी है: कॉल यात्रा से कुछ पहले खुलती हैं',
  'Confirm your phone number on your account page before calling':
    'कॉल करने से पहले अपने खाते के पेज पर अपना फ़ोन नंबर पक्का करें',
  'They have no confirmed phone number. Use the chat instead.':
    'उनका कोई पक्का फ़ोन नंबर नहीं है। इसके बजाय चैट का उपयोग करें।',
  "{name} tried to call you through VAYORA. Calls are simulated, so no call came through. Reply in the ride's chat.":
    '{name} ने VAYORA के ज़रिए आपको कॉल करने की कोशिश की। कॉल सिम्युलेटेड हैं, इसलिए कोई कॉल नहीं आई। सवारी की चैट में जवाब दें।',
  'Call the driver':
    'चालक को कॉल करें',
  'Call {name}':
    '{name} को कॉल करें',
  "Calling is simulated. With a real phone service you would now be connected to {name} through a masked number, so neither of you sees the other's number. No call was placed, and {name} has been told you tried.":
    'कॉल सिम्युलेटेड है। असली फ़ोन सेवा के साथ अब आप एक छिपे हुए नंबर के ज़रिए {name} से जुड़ जाते, ताकि कोई किसी का नंबर न देखे। कोई कॉल नहीं की गई, और {name} को बता दिया गया है कि आपने कोशिश की।',
  'Insurance: {insurer}, until {date}. As you declared it: VAYORA has not checked it with the insurer.':
    'बीमा: {insurer}, {date} तक। जैसा आपने बताया: VAYORA ने बीमा कंपनी से इसकी जाँच नहीं की है।',
  'Remove the insurance':
    'बीमा हटाएँ',
  'Insurance':
    'बीमा',
  'Insurer':
    'बीमा कंपनी',
  'Insured until':
    'बीमा कब तक',
  'Declare insurance':
    'बीमा बताएँ',
  'Passengers see the insurer and the date, marked as not checked. No policy number is asked for.':
    "यात्री बीमा कंपनी और तारीख देखते हैं, 'जाँचा नहीं गया' के निशान के साथ। कोई पॉलिसी नंबर नहीं माँगा जाता।",
  'Insurance declared by the driver: {insurer}, until {date}. Not checked.':
    'चालक द्वारा बताया गया बीमा: {insurer}, {date} तक। जाँचा नहीं गया।',
  'Best match for both of you':
    'आप दोनों के लिए सबसे अच्छा मेल',
  'Match {score} of 100':
    '100 में से {score} मेल',
  "Scored for both of you from what you each said on your profiles, the distance, the price and the driver's record of rides kept. Never from any prediction about either of you. Say what you prefer on your account page to be matched on it.":
    'आप दोनों के लिए अंक इस आधार पर: आपने अपनी प्रोफ़ाइल में क्या बताया, दूरी, कीमत और चालक का निभाई गई सवारियों का रिकॉर्ड। आप दोनों में से किसी के बारे में किसी अनुमान से कभी नहीं। इस पर मेल पाने के लिए अपने खाते के पेज पर अपनी पसंद बताएँ।',
  'Pickup and drop-off close to you':
    'पिकअप और ड्रॉप-ऑफ़ आपके पास',
  'The lowest price here':
    'यहाँ सबसे कम कीमत',
  'You agree about smoking':
    'धूम्रपान पर आप सहमत हैं',
  'You differ about smoking':
    'धूम्रपान पर आपकी राय अलग है',
  'You agree about pets':
    'पालतू जानवरों पर आप सहमत हैं',
  'You differ about pets':
    'पालतू जानवरों पर आपकी राय अलग है',
  'You agree about music':
    'संगीत पर आप सहमत हैं',
  'You differ about music':
    'संगीत पर आपकी राय अलग है',
  'You like the same amount of conversation':
    'आप दोनों को बातचीत उतनी ही पसंद है',
  'One of you wants a quiet ride, the other likes to talk':
    'आप में से एक शांत सफ़र चाहता है, दूसरे को बात करना पसंद है',
  'Minutes you will go out of your way, in all, to pick passengers up at their own point':
    'यात्रियों को उनकी अपनी जगह से लेने के लिए आप कुल कितने मिनट रास्ते से हटेंगे',
  '0 for none: passengers then board only at your stops. Each pickup is worked out before it is offered.':
    'कोई नहीं के लिए 0: तब यात्री केवल आपके स्टॉप पर चढ़ते हैं। हर पिकअप पेश किए जाने से पहले निकाला जाता है।',
  'Enter whole minutes':
    'पूरे मिनट लिखें',
  'Enter 0 or more':
    '0 या अधिक लिखें',
  'At most 30 minutes':
    'अधिकतम 30 मिनट',
  'The driver picks you up at your start, about {time}: {n} min out of their way.':
    'चालक आपको आपकी शुरुआत की जगह से लगभग {time} बजे लेता है: उनके रास्ते से {n} मिनट हटकर।',
  'Picked up at your own point after {stop}, not at the stop.':
    '{stop} के बाद आपकी अपनी जगह से लिया जाएगा, स्टॉप से नहीं।',
  'You offered up to {n} min in all to pick passengers up at their own point':
    'आपने यात्रियों को उनकी अपनी जगह से लेने के लिए कुल {n} मिनट तक की पेशकश की',
  'Picks up at their own point after {stop}: {n} min out of your way.':
    '{stop} के बाद उनकी अपनी जगह से लेना है: आपके रास्ते से {n} मिनट हटकर।',
  'See the point on a map':
    'जगह नक्शे पर देखें',
  'That is more detour than a ride may offer':
    'यह उससे अधिक चक्कर है जितना कोई सवारी पेश कर सकती है',
  'This ride picks up only at its stops':
    'यह सवारी केवल अपने स्टॉप से यात्री लेती है',
  'That pickup would take the driver further out of their way than they offered':
    'उस पिकअप के लिए चालक को जितना पेश किया था उससे अधिक रास्ते से हटना पड़ेगा',
  'How many passengers choose to be rebooked if their driver withdraws':
    'चालक के सवारी वापस लेने पर कितने यात्री दोबारा बुक होना चुनते हैं',
  'Share of passengers with a flexible booking':
    'लचीली बुकिंग वाले यात्रियों का हिस्सा',
  'about {minutes} min walk to the pickup, by footpath':
    'पिकअप तक पैदल रास्ते से लगभग {minutes} मिनट',
  'You are picked up here':
    'आपको यहाँ से लिया जाएगा',
  'You are picked up at your own point, about {time}.':
    'आपको आपकी अपनी जगह से लगभग {time} बजे लिया जाएगा।',
  'As you chose a flexible booking, you are booked on the {time} ride with {driver}, who will pick you up at your own point.':
    'आपने लचीली बुकिंग चुनी थी, इसलिए आपको {driver} की {time} बजे वाली सवारी पर बुक किया गया है, जो आपको आपकी अपनी जगह से लेंगे।',
  'As you chose a flexible booking, you have asked for a seat on the {time} ride with {driver}, who would pick you up at your own point. The driver will answer.':
    'आपने लचीली बुकिंग चुनी थी, इसलिए आपने {driver} की {time} बजे वाली सवारी में सीट माँगी है, जो आपको आपकी अपनी जगह से लेंगे। चालक जवाब देंगे।',
  '{time} with {driver}, picking you up at your own point':
    '{time} बजे {driver} के साथ, आपकी अपनी जगह से लेते हुए',
  'A stretch between two stops is longer than your vehicle covers on a full charge, by your own figures. Add a stop where you can charge.':
    'दो स्टॉप के बीच का एक हिस्सा आपके अपने आँकड़ों के अनुसार पूरी चार्ज पर आपके वाहन की दूरी से लंबा है। ऐसा स्टॉप जोड़ें जहाँ आप चार्ज कर सकें।',
  '{from} to {to} is {km} km, longer than the {range} km your vehicle covers on a full charge, by your own figures. A ride with a stretch that long cannot be published: add a stop between them where you can charge.':
    '{from} से {to} तक {km} किमी है, जो आपके अपने आँकड़ों के अनुसार पूरी चार्ज पर आपके वाहन की {range} किमी की दूरी से लंबा है। इतने लंबे हिस्से वाली सवारी प्रकाशित नहीं की जा सकती: इनके बीच ऐसा स्टॉप जोड़ें जहाँ आप चार्ज कर सकें।',
  'Only a driver can declare an identity document':
    'केवल चालक ही पहचान पत्र घोषित कर सकते हैं',
  'Aadhaar':
    'आधार',
  'PAN card':
    'पैन कार्ड',
  'Driving licence':
    'ड्राइविंग लाइसेंस',
  'Passport':
    'पासपोर्ट',
  'Voter ID':
    'मतदाता पहचान पत्र',
  'Identity document':
    'पहचान पत्र',
  'Declare':
    'घोषित करें',
  'You have declared: {document}.':
    'आपने घोषित किया है: {document}।',
  'Declared: {document}, not checked':
    'कहते हैं कि उनके पास {document} है, जाँचा नहीं गया',
  'You can say which identity document you hold. VAYORA never asks for its number or keeps a copy. Your profile says it was declared and not checked, until VAYORA staff have seen it.':
    'आप बता सकते हैं कि आपके पास कौन-सा पहचान पत्र है। VAYORA उसका नंबर कभी नहीं माँगता और न ही प्रति रखता है। जब तक VAYORA कर्मचारी उसे देख न लें, आपकी प्रोफ़ाइल में लिखा रहता है कि वह घोषित है, जाँचा नहीं गया।',
  'Sign in first':
    'पहले साइन इन करें',
  'Your session has ended. Sign in again.':
    'आपका सत्र समाप्त हो गया है। फिर से साइन इन करें।',
  'Only an administrator can run the simulator':
    'केवल प्रशासक ही सिम्युलेटर चला सकते हैं',
  'Live runs are not set up on this server':
    'इस सर्वर पर अभी के रन सेट नहीं हैं',
  'No such sweep can be run live':
    'ऐसा कोई स्वीप अभी नहीं चलाया जा सकता',
  'You can have at most {n} emergency contacts':
    'आप अधिकतम {n} आपातकालीन संपर्क रख सकते हैं',
  'This vehicle can offer at most {n} seats':
    'यह वाहन अधिकतम {n} सीटें दे सकता है',
  'A ride can repeat for at most {n} further weeks':
    'एक सवारी अधिकतम {n} और हफ़्तों तक दोहराई जा सकती है',
  'A {status} booking cannot become {next}':
    '{status} बुकिंग {next} नहीं हो सकती',
  'Idempotency-Key must be 1 to {n} characters':
    'Idempotency-Key 1 से {n} अक्षरों का होना चाहिए',
  'pending':
    'लंबित',
  'confirmed':
    'पक्की',
  'declined':
    'अस्वीकृत',
  'cancelled':
    'रद्द',
  'completed':
    'पूरी',
  'no-show':
    'अनुपस्थित',
  'Simulator runs on synthetic data, not real passengers. Changing a setting shows another saved run, and only the settings a sweep was run at can be chosen there. Any other value can be simulated below, as an exploration.':
    'कृत्रिम डेटा पर सिम्युलेटर के रन, असली यात्रियों पर नहीं। सेटिंग बदलने पर एक और सहेजा गया रन दिखता है, और वहाँ केवल वही सेटिंग चुनी जा सकती हैं जिन पर स्वीप चलाया गया था। कोई और मान नीचे खोज के तौर पर सिम्युलेट किया जा सकता है।',
  'Simulate another value now':
    'अभी कोई और मान सिम्युलेट करें',
  'Runs the simulator now, at a value no sweep was run at. Exploratory: means and the mean difference only, with no interval; kept nowhere, and never a report figure. About a second for every two seeds.':
    'सिम्युलेटर को अभी उस मान पर चलाता है जिस पर कोई स्वीप नहीं चला। केवल खोज के लिए: केवल औसत और औसत अंतर, बिना अंतराल के; कहीं सहेजा नहीं जाता, और कभी रिपोर्ट का आँकड़ा नहीं। हर दो सीड पर लगभग एक सेकंड।',
  'This question cannot be simulated live.':
    'यह प्रश्न अभी सिम्युलेट नहीं किया जा सकता।',
  'from {min} to {max}':
    '{min} से {max} तक',
  'Value to simulate':
    'सिम्युलेट करने का मान',
  'Seeds':
    'सीड',
  'Simulating…':
    'सिम्युलेट हो रहा है…',
  'Simulate':
    'सिम्युलेट करें',
  'Live result':
    'अभी का परिणाम',
  'Difference':
    'अंतर',
  'Seeds up / down':
    'सीड ऊपर / नीचे',
  '{variant} compared with {baseline} at {value}, on {seeds} seeds, simulated just now. Exploratory: no interval, and not a report figure.':
    '{value} पर {variant} की तुलना {baseline} से, {seeds} सीड पर, अभी सिम्युलेट की गई। केवल खोज के लिए: कोई अंतराल नहीं, और रिपोर्ट का आँकड़ा नहीं।',
  'Or about {minutes} min by auto-rickshaw to the pickup; no meter fare is known there':
    'या ऑटो-रिक्शा से पिकअप तक लगभग {minutes} मिनट; वहाँ का मीटर किराया ज्ञात नहीं है',
  'Or about {minutes} min by auto-rickshaw from the drop-off; no meter fare is known there':
    'या ड्रॉप से ऑटो-रिक्शा से लगभग {minutes} मिनट; वहाँ का मीटर किराया ज्ञात नहीं है',
  'Or about {minutes} min by auto-rickshaw to the pickup, about {fare} by the {town} meter fare':
    'या ऑटो-रिक्शा से पिकअप तक लगभग {minutes} मिनट, {town} के मीटर किराए से लगभग {fare}',
  'Or about {minutes} min by auto-rickshaw from the drop-off, about {fare} by the {town} meter fare':
    'या ड्रॉप से ऑटो-रिक्शा से लगभग {minutes} मिनट, {town} के मीटर किराए से लगभग {fare}',
  'roughly: in a straight line':
    'मोटे तौर पर: सीधी रेखा में',
  'An estimate: the meter, traffic and hour decide. Fare published by {source}, in force from {date}.':
    'अनुमान: असली किराया मीटर, यातायात और समय तय करते हैं। किराया {source} द्वारा प्रकाशित, {date} से लागू।',
  'The text message could not be sent. Try again later.':
    'टेक्स्ट संदेश नहीं भेजा जा सका। बाद में फिर कोशिश करें।',
  '{n} of your emergency contacts could not be messaged. Call them yourself, or call 112.':
    'आपके {n} आपातकालीन संपर्कों को संदेश नहीं भेजा जा सका। उन्हें खुद फ़ोन करें, या 112 पर कॉल करें।',
  '{n} emergency contacts could not be messaged.':
    '{n} आपातकालीन संपर्कों को संदेश नहीं भेजा जा सका।',
  "{name} is calling you through VAYORA, from the platform's number. Neither of you sees the other's number.":
    '{name} VAYORA के ज़रिए, प्लेटफ़ॉर्म के नंबर से आपको कॉल कर रहे हैं। आप दोनों में से कोई भी दूसरे का नंबर नहीं देखता।',
  "The call could not be placed. Try again, or use the ride's chat.":
    'कॉल नहीं लग सकी। फिर कोशिश करें, या सवारी की चैट का उपयोग करें।',
  "Your phone will ring now from VAYORA's number. Answer it to be connected to {name}: neither of you sees the other's number.":
    'अब आपका फ़ोन VAYORA के नंबर से बजेगा। {name} से जुड़ने के लिए उठाएँ: आप दोनों में से कोई भी दूसरे का नंबर नहीं देखता।',
  'Those stops are not on this ride':
    'ये स्टॉप इस सवारी पर नहीं हैं',
  'Too many wrong attempts. Request a new code.':
    'बहुत अधिक गलत प्रयास। नया कोड माँगें।',
  'That is as many codes as one day allows. Try again tomorrow.':
    'एक दिन में इतने ही कोड मिल सकते हैं। कल फिर कोशिश करें।',
  'Too many wrong passwords. Try again in {n} min.':
    'बहुत अधिक गलत पासवर्ड। {n} मिनट बाद फिर कोशिश करें।',
  'User not found':
    'उपयोगकर्ता नहीं मिला',
  'Vehicle not found':
    'वाहन नहीं मिला',
  'Vehicle not found among your vehicles':
    'आपके वाहनों में यह वाहन नहीं मिला',
  'You already have an open report about this member':
    'इस सदस्य के बारे में आपकी एक रिपोर्ट पहले से खुली है',
  'You can only report someone you have booked or driven with':
    'आप केवल उसी की रिपोर्ट कर सकते हैं जिसके साथ आपने बुकिंग या सवारी की हो',
  'You cannot report yourself':
    'आप अपनी ही रिपोर्ट नहीं कर सकते',
  'You have already answered for this trip':
    'आप इस यात्रा के लिए पहले ही उत्तर दे चुके हैं',
  'You have already rated this trip':
    'आप इस यात्रा को पहले ही रेटिंग दे चुके हैं',
  'You sign in with your phone number, so it cannot be removed':
    'आप अपने फ़ोन नंबर से साइन इन करते हैं, इसलिए इसे हटाया नहीं जा सकता',
  'toSeq must come after fromSeq':
    'toSeq को fromSeq के बाद आना चाहिए',
  'This account is suspended':
    'यह खाता निलंबित है',
  'Invalid request content.':
    'अनुरोध की सामग्री अमान्य है।',
  'Cannot reach the server. Check your connection and try again.':
    'सर्वर तक नहीं पहुँच पा रहे। अपना कनेक्शन जाँचें और फिर कोशिश करें।',
  // Unmet demand
  'Passengers looked for a ride from {from} to {to} on {date} and found none. If you are driving then, you could offer seats.':
    'यात्रियों ने {date} को {from} से {to} की सवारी खोजी और कोई नहीं मिली। अगर आप तब जा रहे हैं, तो सीटें दे सकते हैं।',
  'Unmet demand':
    'अपूरी माँग',
  'Days in the coming week where at least three searches on one stretch found no ride. Each morning, a few drivers who have driven the stretch are told, none more than once a week. Whether they then offer a ride is recorded, not reported as a result.':
    'आने वाले सप्ताह के वे दिन जब एक ही हिस्से पर कम से कम तीन खोजों में कोई सवारी नहीं मिली। हर सुबह, उस हिस्से पर चल चुके कुछ चालकों को बताया जाता है, किसी को सप्ताह में एक बार से अधिक नहीं। वे बाद में सवारी देते हैं या नहीं, यह दर्ज होता है, परिणाम के रूप में नहीं बताया जाता।',
  'No gaps in the coming week.':
    'आने वाले सप्ताह में कोई कमी नहीं।',
  'Stretch':
    'हिस्सा',
  'Searches with no ride':
    'बिना सवारी वाली खोजें',
  'Drivers told':
    'बताए गए चालक',
  // Google sign-in
  'Google sign-in could not be loaded. Use your email or phone instead.':
    'Google साइन-इन लोड नहीं हो सका। इसके बजाय अपना ईमेल या फ़ोन उपयोग करें।',
  'or':
    'या',
  'No VAYORA account uses this Google address yet. How will you use VAYORA?':
    'इस Google पते से अभी कोई VAYORA खाता नहीं है। आप VAYORA का उपयोग कैसे करेंगे?',
  'Google sign-in is not set up on this server':
    'इस सर्वर पर Google साइन-इन सेट नहीं है',
  'That Google sign-in could not be checked':
    'उस Google साइन-इन की जाँच नहीं हो सकी',
  'Google has not confirmed this email address':
    'Google ने इस ईमेल पते की पुष्टि नहीं की है',
  'No account uses this Google address yet. Choose passenger or driver to create one.':
    'इस Google पते से अभी कोई खाता नहीं है। खाता बनाने के लिए यात्री या चालक चुनें।',
  // Front page
  'Book a seat in a car already making the trip, or fill the empty seats in yours. If your plans change, VAYORA reminds you to give the seat back while someone else can still take it.':
    'उस कार में सीट बुक करें जो पहले से यह सफ़र कर रही है, या अपनी कार की खाली सीटें भरें। अगर आपकी योजना बदल जाए, तो VAYORA आपको तब तक सीट लौटाने की याद दिलाता है, जब तक कोई और उसे ले सकता है।',
  'Offer a ride':
    'सवारी दें',
  'An emergency button on every trip':
    'हर सफ़र पर आपातकालीन बटन',
  'days ahead you can book':
    'दिन पहले तक बुक कर सकते हैं',
  'languages':
    'भाषाएँ',
  'How it works':
    'यह कैसे काम करता है',
  'Choose where you start and where you are going, or a point on the map. Rides passing within reach are shown with the walk to where you board.':
    'चुनें कि आप कहाँ से शुरू करते हैं और कहाँ जा रहे हैं, या नक्शे पर कोई जगह। पहुँच में से गुज़रने वाली सवारियाँ, चढ़ने की जगह तक पैदल रास्ते के साथ दिखाई जाती हैं।',
  'Book a seat':
    'सीट बुक करें',
  'Travel together':
    'साथ यात्रा करें',
  'Chat with your driver and follow the car on the map. The emergency button puts calling 112 first.':
    'अपने चालक से चैट करें और नक्शे पर कार को देखें। आपातकालीन बटन सबसे पहले 112 पर कॉल करने को रखता है।',
  'Why giving a seat back early matters':
    'सीट जल्दी लौटाना क्यों मायने रखता है',
  'A seat given back three days before departure can still be booked by someone else. Given back two hours before, it usually travels empty. So VAYORA asks early, asks for less of the fare the earlier you cancel, and never cancels anyone on a guess.':
    'प्रस्थान से तीन दिन पहले लौटाई गई सीट को कोई और अब भी बुक कर सकता है। दो घंटे पहले लौटाई गई सीट आमतौर पर खाली जाती है। इसलिए VAYORA जल्दी पूछता है, जितनी जल्दी आप रद्द करें उतना कम किराया माँगता है, और किसी अनुमान के आधार पर कभी किसी की बुकिंग रद्द नहीं करता।',
  'The project measures what counts: rides completed for every 100 searches, not bookings made.':
    'परियोजना वही मापती है जो मायने रखता है: हर 100 खोजों पर पूरी हुई सवारियाँ, न कि की गई बुकिंग।',
  'Days before: someone else can book it':
    'दिनों पहले: कोई और इसे बुक कर सकता है',
  'Hours before: the seat is usually lost':
    'घंटों पहले: सीट आमतौर पर खाली जाती है',
  'Pickups on the way':
    'रास्ते में पिकअप',
  'A driver can take a few minutes out of the way to pick you up where the road passes.':
    'चालक कुछ मिनट रास्ते से हटकर आपको वहाँ से ले सकता है जहाँ से सड़क गुज़रती है।',
  'Women-only rides':
    'केवल महिलाओं के लिए सवारियाँ',
  'A driver can offer a ride to women only; only women see it or can book it.':
    'चालक कोई सवारी केवल महिलाओं के लिए दे सकता है; उसे केवल महिलाएँ देख और बुक कर सकती हैं।',
  'Flexible bookings':
    'लचीली बुकिंग',
  'Choose a window of time. If your driver withdraws, VAYORA looks for another ride in it, at the same price.':
    'समय की एक अवधि चुनें। अगर आपका चालक सवारी वापस ले ले, तो VAYORA उसी अवधि में, उसी कीमत पर, दूसरी सवारी खोजता है।',
  'Electric cars':
    'इलेक्ट्रिक कारें',
  'A route an electric car cannot cover on one charge is caught before it is published, with chargers along the way.':
    'जिस मार्ग को इलेक्ट्रिक कार एक चार्ज में तय नहीं कर सकती, वह प्रकाशित होने से पहले पकड़ लिया जाता है, रास्ते के चार्जरों के साथ।',
  'Buses when no car goes':
    'जब कोई कार न जाए, तो बसें',
  'When no ride fits, buses on the same stretch are suggested.':
    'जब कोई सवारी मेल न खाए, तो उसी हिस्से की बसें सुझाई जाती हैं।',
  'Three languages':
    'तीन भाषाएँ',
  'Every screen in English, Hindi and Marathi, receipts included.':
    'हर स्क्रीन अंग्रेज़ी, हिंदी और मराठी में, रसीदें भी।',
  'For passengers':
    'यात्रियों के लिए',
  'Pay only for the stretch you ride':
    'केवल उतने हिस्से का भुगतान करें जितनी आप यात्रा करते हैं',
  "Each driver's record of rides kept, and their ratings":
    'हर चालक का निभाई गई सवारियों का रिकॉर्ड, और उनकी रेटिंग',
  'Create a passenger account':
    'यात्री खाता बनाएँ',
  'For drivers':
    'चालकों के लिए',
  'Publish once, or repeat a ride every week':
    'एक बार प्रकाशित करें, या हर सप्ताह सवारी दोहराएँ',
  'Approve each passenger, or let them book at once':
    'हर यात्री को मंज़ूरी दें, या उन्हें तुरंत बुक करने दें',
  'Create a driver account':
    'चालक खाता बनाएँ',
  // Paying after the ride
  'Cash to the driver':
    'चालक को नकद',
  'Pay after the ride':
    'सवारी के बाद भुगतान',
  'nothing owed':
    'कुछ बकाया नहीं',
  'pay after the ride':
    'सवारी के बाद भुगतान',
  'Owes nothing':
    'कुछ बकाया नहीं',
  'Pays after the ride':
    'सवारी के बाद भुगतान करेंगे',
  'Yes, I was paid {amount} in cash':
    'हाँ, मुझे {amount} नकद मिले',
  'Nothing owed':
    'कुछ बकाया नहीं',
  'Nothing is due on this booking':
    'इस बुकिंग पर कुछ बकाया नहीं है',
  'Your driver recorded Rs {amount} paid in cash for {seats}.':
    'आपके चालक ने {seats} के लिए Rs {amount} नकद भुगतान दर्ज किया।',
  // Any route in India
  'Choose a place':
    'जगह चुनें',
  'Choose a different place from where you start':
    'शुरुआती जगह से अलग जगह चुनें',
  'Choose a different place from the stop before':
    'पिछले पड़ाव से अलग जगह चुनें',
  'Minutes from {start} to {town}':
    '{start} से {town} तक मिनट',
  'Stop on the way {n}':
    'रास्ते का पड़ाव {n}',
  'Add a stop on the way':
    'रास्ते में एक पड़ाव जोड़ें',
  'Remove this stop':
    'यह पड़ाव हटाएँ',
  'Map around your start and destination. Click to choose an exact point.':
    'आपके शुरुआती स्थान और गंतव्य के आसपास का नक्शा। सटीक स्थान चुनने के लिए क्लिक करें।',
  'Share the road between cities across India':
    'पूरे भारत में शहरों के बीच सफ़र साझा करें',
  'Any route in India':
    'भारत का कोई भी मार्ग',
  'cities to choose from':
    'चुनने के लिए शहर',
  'Search your route':
    'अपना मार्ग खोजें',
  'Made for travelling between cities':
    'शहरों के बीच यात्रा के लिए बना',
  'Road distances and times are worked out between Kolhapur and Pune. On other routes they are a straight-line estimate, and say so.':
    'सड़क की दूरी और समय कोल्हापुर और पुणे के बीच निकाले जाते हैं। दूसरे मार्गों पर वे सीधी रेखा का अनुमान होते हैं, और यह बताया जाता है।',
  'The research behind VAYORA was run on the Kolhapur to Pune route.':
    'VAYORA के पीछे का शोध कोल्हापुर से पुणे मार्ग पर किया गया था।',
  'VAYORA, shared rides between cities':
    'VAYORA, शहरों के बीच साझा सवारी',
  // Places in India
  'Maharashtra': 'महाराष्ट्र',
  'Andhra Pradesh': 'आंध्र प्रदेश',
  'Arunachal Pradesh': 'अरुणाचल प्रदेश',
  'Assam': 'असम',
  'Bihar': 'बिहार',
  'Chandigarh': 'चंडीगढ़',
  'Chhattisgarh': 'छत्तीसगढ़',
  'Dadra and Nagar Haveli and Daman and Diu': 'दादरा और नगर हवेली और दमन और दीव',
  'Delhi': 'दिल्ली',
  'Goa': 'गोवा',
  'Gujarat': 'गुजरात',
  'Haryana': 'हरियाणा',
  'Himachal Pradesh': 'हिमाचल प्रदेश',
  'Jammu and Kashmir': 'जम्मू और कश्मीर',
  'Jharkhand': 'झारखंड',
  'Karnataka': 'कर्नाटक',
  'Kerala': 'केरल',
  'Ladakh': 'लद्दाख',
  'Madhya Pradesh': 'मध्य प्रदेश',
  'Manipur': 'मणिपुर',
  'Meghalaya': 'मेघालय',
  'Mizoram': 'मिज़ोरम',
  'Nagaland': 'नागालैंड',
  'Odisha': 'ओडिशा',
  'Puducherry': 'पुडुचेरी',
  'Punjab': 'पंजाब',
  'Rajasthan': 'राजस्थान',
  'Sikkim': 'सिक्किम',
  'Tamil Nadu': 'तमिलनाडु',
  'Telangana': 'तेलंगाना',
  'Tripura': 'त्रिपुरा',
  'Uttar Pradesh': 'उत्तर प्रदेश',
  'Uttarakhand': 'उत्तराखंड',
  'West Bengal': 'पश्चिम बंगाल',
  'Ahilyanagar': 'अहिल्यानगर',
  'Amravati': 'अमरावती',
  'Chhatrapati Sambhajinagar': 'छत्रपति संभाजीनगर',
  'Jalgaon': 'जलगाँव',
  'Latur': 'लातूर',
  'Mumbai': 'मुंबई',
  'Nagpur': 'नागपुर',
  'Nanded': 'नांदेड़',
  'Nashik': 'नासिक',
  'Navi Mumbai': 'नवी मुंबई',
  'Ratnagiri': 'रत्नागिरी',
  'Sangli': 'सांगली',
  'Solapur': 'सोलापुर',
  'Thane': 'ठाणे',
  'Guntur': 'गुंटूर',
  'Kurnool': 'कुरनूल',
  'Nellore': 'नेल्लोर',
  'Tirupati': 'तिरुपति',
  'Vijayawada': 'विजयवाड़ा',
  'Visakhapatnam': 'विशाखापत्तनम',
  'Itanagar': 'ईटानगर',
  'Dibrugarh': 'डिब्रूगढ़',
  'Guwahati': 'गुवाहाटी',
  'Silchar': 'सिलचर',
  'Gaya': 'गया',
  'Muzaffarpur': 'मुज़फ़्फ़रपुर',
  'Patna': 'पटना',
  'Bilaspur': 'बिलासपुर',
  'Raipur': 'रायपुर',
  'Silvassa': 'सिलवासा',
  'New Delhi': 'नई दिल्ली',
  'Margao': 'मडगाँव',
  'Panaji': 'पणजी',
  'Ahmedabad': 'अहमदाबाद',
  'Bhavnagar': 'भावनगर',
  'Gandhinagar': 'गांधीनगर',
  'Jamnagar': 'जामनगर',
  'Rajkot': 'राजकोट',
  'Surat': 'सूरत',
  'Vadodara': 'वडोदरा',
  'Ambala': 'अंबाला',
  'Faridabad': 'फ़रीदाबाद',
  'Gurugram': 'गुरुग्राम',
  'Hisar': 'हिसार',
  'Dharamshala': 'धर्मशाला',
  'Manali': 'मनाली',
  'Shimla': 'शिमला',
  'Jammu': 'जम्मू',
  'Srinagar': 'श्रीनगर',
  'Dhanbad': 'धनबाद',
  'Jamshedpur': 'जमशेदपुर',
  'Ranchi': 'रांची',
  'Belagavi': 'बेलगावी',
  'Bengaluru': 'बेंगलुरु',
  'Hubballi': 'हुबली',
  'Kalaburagi': 'कलबुर्गी',
  'Mangaluru': 'मंगलुरु',
  'Mysuru': 'मैसूर',
  'Kochi': 'कोच्चि',
  'Kozhikode': 'कोझिकोड',
  'Thiruvananthapuram': 'तिरुवनंतपुरम',
  'Thrissur': 'त्रिशूर',
  'Leh': 'लेह',
  'Bhopal': 'भोपाल',
  'Gwalior': 'ग्वालियर',
  'Indore': 'इंदौर',
  'Jabalpur': 'जबलपुर',
  'Ujjain': 'उज्जैन',
  'Imphal': 'इंफाल',
  'Shillong': 'शिलांग',
  'Aizawl': 'आइज़ोल',
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
  'Bikaner': 'बीकानेर',
  'Jaipur': 'जयपुर',
  'Jodhpur': 'जोधपुर',
  'Kota': 'कोटा',
  'Udaipur': 'उदयपुर',
  'Gangtok': 'गंगटोक',
  'Chennai': 'चेन्नई',
  'Coimbatore': 'कोयंबटूर',
  'Kanniyakumari': 'कन्याकुमारी',
  'Madurai': 'मदुरै',
  'Salem': 'सेलम',
  'Tiruchirappalli': 'तिरुचिरापल्ली',
  'Tirunelveli': 'तिरुनेलवेली',
  'Vellore': 'वेल्लोर',
  'Hyderabad': 'हैदराबाद',
  'Nizamabad': 'निज़ामाबाद',
  'Warangal': 'वारंगल',
  'Agartala': 'अगरतला',
  'Agra': 'आगरा',
  'Ayodhya': 'अयोध्या',
  'Bareilly': 'बरेली',
  'Ghaziabad': 'गाज़ियाबाद',
  'Gorakhpur': 'गोरखपुर',
  'Kanpur': 'कानपुर',
  'Lucknow': 'लखनऊ',
  'Mathura': 'मथुरा',
  'Meerut': 'मेरठ',
  'Noida': 'नोएडा',
  'Prayagraj': 'प्रयागराज',
  'Varanasi': 'वाराणसी',
  'Dehradun': 'देहरादून',
  'Haridwar': 'हरिद्वार',
  'Nainital': 'नैनीताल',
  'Rishikesh': 'ऋषिकेश',
  'Asansol': 'आसनसोल',
  'Darjeeling': 'दार्जिलिंग',
  'Durgapur': 'दुर्गापुर',
  'Kolkata': 'कोलकाता',
  'Siliguri': 'सिलीगुड़ी',
  // The live interface
  'Could not refresh':
    'ताज़ा नहीं हो सका',
  'Live':
    'लाइव',
  'updated {time}':
    '{time} अपडेट हुआ',
  'Refresh now':
    'अभी ताज़ा करें',
  'Leaves in {time}':
    '{time} में रवाना',
  'Back online':
    'फिर से ऑनलाइन',
  'You are offline. What you see may be out of date.':
    'आप ऑफ़लाइन हैं। जो दिख रहा है वह पुराना हो सकता है।',
  'See all notifications':
    'सभी सूचनाएँ देखें',
  'Recent notifications':
    'हाल की सूचनाएँ',
  'Operations':
    'संचालन',
  'Trust and safety':
    'विश्वास और सुरक्षा',
  'Insights':
    'विश्लेषण',
  'Recent':
    'हाल के',
  'Near me':
    'मेरे पास',
  'No place by that name is listed. Choose the nearest, then pick the exact point on the map.':
    'इस नाम की कोई जगह सूची में नहीं है। सबसे नज़दीकी चुनें, फिर नक्शे पर सटीक स्थान चुनें।',
  'Today':
    'आज',
  'Tomorrow':
    'कल',
  'Time left on the hold':
    'होल्ड का बचा समय',
  'Swap start and destination':
    'शुरुआत और गंतव्य बदलें',
  '{n} ride found':
    '{n} सवारी मिली',
  '{n} rides found':
    '{n} सवारियाँ मिलीं',
  'Seats are live':
    'सीटें लाइव हैं',
  'This ride is no longer available.':
    'यह सवारी अब उपलब्ध नहीं है।',
  'Too few seats are left on this ride now.':
    'इस सवारी में अब बहुत कम सीटें बची हैं।',
  'More about this ride':
    'इस सवारी के बारे में और',
  'Requested':
    'अनुरोध किया',
  'Accepted':
    'स्वीकृत',
  'Under way':
    'चल पड़ी',
  'Arrived':
    'पहुँच गए',
  'How far this booking has got':
    'यह बुकिंग कहाँ तक पहुँची है',
  'Your ride is on the road. Open the chat to see where the driver is.':
    'आपकी सवारी रास्ते में है। चालक कहाँ है, यह देखने के लिए चैट खोलें।',
  'Coming up':
    'आने वाली',
  'Earlier':
    'पहले की',
  'Last sent {time}.':
    'आखिरी बार {time} भेजा।',
  'Connected':
    'जुड़ा हुआ',
  'Connection lost. Reconnecting…':
    'कनेक्शन टूट गया। फिर से जोड़ा जा रहा है…',
  'Rides ahead':
    'आने वाली सवारियाँ',
  'Seats booked on them':
    'उन पर बुक की गई सीटें',
  'Your next ride':
    'आपकी अगली सवारी',
  'Time to set off':
    'चलने का समय',
  'In the last 7 days':
    'पिछले 7 दिनों में',
  'Example':
    'उदाहरण',
  // Paying the driver directly, in cash or by UPI
  'Paid to you each week (₹)':
    'हर सप्ताह आपको मिला भुगतान (₹)',
  'UPI ID':
    'UPI आईडी',
  'Copied':
    'कॉपी हो गया',
  'Copy':
    'कॉपी करें',
  'Open in my UPI app':
    'मेरे UPI ऐप में खोलें',
  'Pay {name} {amount} in cash, or by UPI from your own app.':
    '{name} को {amount} नकद दें, या अपने UPI ऐप से भेजें।',
  'Pay {name} {amount} in cash: they have not given a UPI ID or QR code.':
    '{name} को {amount} नकद दें: उन्होंने UPI आईडी या QR कोड नहीं दिया है।',
  'UPI QR code of {name}':
    '{name} का UPI QR कोड',
  'Check the name your UPI app shows before you pay. VAYORA never sees this money and cannot get it back.':
    'भुगतान से पहले अपने UPI ऐप में दिखने वाला नाम जाँच लें। VAYORA यह पैसा कभी नहीं देखता और इसे वापस नहीं दिला सकता।',
  'Paid in cash':
    'नकद मिला',
  'Paid by UPI':
    'UPI से मिला',
  'Yes, I was paid {amount} by UPI':
    'हाँ, मुझे UPI से {amount} मिले',
  'Passengers pay you directly after the ride, in cash or by UPI, and VAYORA takes nothing. They see these only once their booking is confirmed.':
    'यात्री सवारी के बाद सीधे आपको नकद या UPI से भुगतान करते हैं, और VAYORA कुछ नहीं लेता। यात्रियों को ये विवरण तभी दिखते हैं जब उनकी बुकिंग पक्की हो जाए।',
  'Your UPI ID':
    'आपकी UPI आईडी',
  'As your UPI app shows it, like name@bank.':
    'जैसा आपके UPI ऐप में दिखता है, जैसे name@bank।',
  'Save UPI ID':
    'UPI आईडी सहेजें',
  'Your UPI ID is saved.':
    'आपकी UPI आईडी सहेज ली गई है।',
  'Your UPI ID is removed.':
    'आपकी UPI आईडी हटा दी गई है।',
  'Your UPI QR code':
    'आपका UPI QR कोड',
  'Choose your UPI QR code':
    'अपना UPI QR कोड चुनें',
  'Replace QR code':
    'QR कोड बदलें',
  'Add a QR code':
    'QR कोड जोड़ें',
  'Remove QR code':
    'QR कोड हटाएँ',
  'A screenshot from your UPI app, as a JPEG or PNG up to 5 MB. Scan it yourself once it is up, to check it still works.':
    'आपके UPI ऐप का स्क्रीनशॉट, JPEG या PNG में, 5 MB तक। अपलोड के बाद खुद स्कैन करके जाँच लें कि यह काम कर रहा है।',
  'Before the driver accepts: nothing to pay.':
    'चालक के स्वीकार करने से पहले: कुछ नहीं देना।',
  '{when}: nothing to pay.':
    '{when}: कुछ नहीं देना।',
  '{when}: {share} of the fare to your driver.':
    '{when}: किराए का {share} आपके चालक को।',
  'Less than {hours} hours before boarding, or if you do not turn up: the whole fare to your driver.':
    'सवार होने से {hours} घंटे से कम पहले, या न पहुँचने पर: पूरा किराया आपके चालक को।',
  'If the driver cancels or declines: nothing to pay.':
    'यदि चालक रद्द करे या अस्वीकार करे: कुछ नहीं देना।',
  'You cannot book again until your driver marks what you owe as paid.':
    'जब तक आपका चालक बकाया को मिला हुआ दर्ज नहीं करता, आप फिर से बुक नहीं कर सकते।',
  'The driver did not answer your request for {seats} in time, so it has been closed. You owe nothing.':
    'चालक ने {seats} के आपके अनुरोध का समय पर उत्तर नहीं दिया, इसलिए इसे बंद कर दिया गया है। आपको कुछ नहीं देना।',
  'The driver did not accept your request for {seats}. You owe nothing.':
    'चालक ने {seats} का आपका अनुरोध स्वीकार नहीं किया। आपको कुछ नहीं देना।',
  'The driver reported that you did not board for {seats}.':
    'चालक ने बताया कि आप {seats} के लिए सवार नहीं हुए।',
  'The driver cancelled the ride you booked for {seats}. You owe nothing. {more}':
    'चालक ने वह सवारी रद्द कर दी जिसमें आपने {seats} बुक की थीं। आपको कुछ नहीं देना। {more}',
  'Your seat from {from} to {to} leaves {when}. If your plans have changed, cancelling now lets someone else take it, and you would owe nothing. If you are still travelling, there is nothing to do.':
    '{from} से {to} तक आपकी सीट {when} को निकलती है। अगर आपकी योजना बदल गई है, तो अभी रद्द करने से कोई और यह सीट ले सकता है, और आपको कुछ नहीं देना होगा। अगर आप यात्रा कर रहे हैं, तो कुछ करने की ज़रूरत नहीं।',
  'Your seat from {from} to {to} leaves {when}. If your plans have changed, cancelling now lets someone else take it, and you would owe your driver Rs {owed} of your Rs {fare} fare. If you are still travelling, there is nothing to do.':
    '{from} से {to} तक आपकी सीट {when} को निकलती है। अगर आपकी योजना बदल गई है, तो अभी रद्द करने से कोई और यह सीट ले सकता है, और आपको अपने Rs {fare} किराए में से Rs {owed} चालक को देने होंगे। अगर आप यात्रा कर रहे हैं, तो कुछ करने की ज़रूरत नहीं।',
  'Your trip from {from} to {to} is complete. Pay your driver Rs {amount}, in cash or by UPI: see My bookings.':
    '{from} से {to} तक आपकी यात्रा पूरी हुई। अपने चालक को Rs {amount} नकद या UPI से दें: मेरी बुकिंग देखें।',
  'The driver reported that you did not board for {seats}. The full Rs {amount} is owed to them: see My bookings.':
    'चालक ने बताया कि आप {seats} के लिए सवार नहीं हुए। पूरे Rs {amount} उन्हें देने हैं: मेरी बुकिंग देखें।',
  '{passenger} cancelled {seats}, late enough to owe you Rs {amount}.':
    '{passenger} ने {seats} देर से रद्द की, इसलिए आपको Rs {amount} मिलने हैं।',
  'Your driver recorded Rs {amount} paid by UPI for {seats}.':
    'आपके चालक ने {seats} के लिए Rs {amount} UPI से मिलने की बात दर्ज की।',
  'VAYORA staff cleared what you owed for {seats}, so you can book again.':
    'VAYORA कर्मचारियों ने {seats} का आपका बकाया हटा दिया है, इसलिए आप फिर से बुक कर सकते हैं।',
  'VAYORA staff cleared what {passenger} owed you for {seats}.':
    'VAYORA कर्मचारियों ने {seats} के लिए {passenger} का आपका बकाया हटा दिया है।',
  'The trip':
    'यात्रा',
  'A seat you did not take up':
    'वह सीट जो आपने नहीं ली',
  'Cancelling late':
    'देर से रद्द करना',
  'You still owe a driver for an earlier booking. You can book again once they mark it paid: see My bookings.':
    'पिछली बुकिंग का पैसा अभी चालक को देना बाकी है। उनके दर्ज करने पर आप फिर से बुक कर सकेंगे: मेरी बुकिंग देखें।',
  'That does not look like a UPI ID. It looks like name@bank, as your UPI app shows it':
    'यह UPI आईडी नहीं लगती। यह name@bank जैसी होती है, जैसा आपके UPI ऐप में दिखता है',
  'No QR code':
    'कोई QR कोड नहीं',
  'How passengers pay you':
    'यात्री आपको कैसे भुगतान करते हैं',
  'Only those still owing a driver':
    'केवल वे जिन पर चालक का बकाया है',
  'Owes the driver {amount}':
    'चालक को {amount} देने हैं',
  'Why clear it':
    'इसे क्यों हटा रहे हैं',
  'For a driver who was paid and will not mark it. Kept in the audit log, and not shown to either side.':
    'उस चालक के लिए जिसे पैसे मिल गए पर जो इसे दर्ज नहीं करता। यह ऑडिट लॉग में रहता है और किसी पक्ष को नहीं दिखता।',
  'Clear what is owed':
    'बकाया हटाएँ',
  'Yes, clear it':
    'हाँ, हटाएँ',
  'Passengers pay you directly after the ride, in cash or by UPI.':
    'यात्री सवारी के बाद सीधे आपको नकद या UPI से भुगतान करते हैं।',
  'Your UPI ID and QR code':
    'आपकी UPI आईडी और QR कोड',
  '{amount} owed to you':
    'आपको {amount} मिलने हैं',
  'Passengers pay you directly, in cash or by UPI, and VAYORA takes nothing. What shows here is what you marked as paid.':
    'यात्री सीधे आपको नकद या UPI से भुगतान करते हैं, और VAYORA कुछ नहीं लेता। यहाँ वही दिखता है जिसे आपने मिला हुआ दर्ज किया।',
  'Nothing yet. Once a trip ends, what passengers owe you shows here.':
    'अभी कुछ नहीं। यात्रा समाप्त होने पर यात्रियों का बकाया यहाँ दिखेगा।',
  'Waiting to be paid':
    'भुगतान की प्रतीक्षा में',
  'A passenger cannot book again until you mark what they owe as paid.':
    'जब तक आप बकाया को मिला हुआ दर्ज नहीं करते, यात्री फिर से बुक नहीं कर सकता।',
  'Total paid to you':
    'आपको कुल मिला',
  'The earlier you cancel, the less you owe':
    'जितनी जल्दी रद्द करें, उतना कम देना',
  'Your seat is held while you decide':
    'निर्णय लेते समय आपकी सीट रोकी रहती है',
  'Pay the driver directly, in cash or by UPI':
    'चालक को सीधे नकद या UPI से भुगतान करें',
  'Keep the whole fare: VAYORA charges nothing':
    'पूरा किराया आपका: VAYORA कुछ नहीं लेता',
  'A final-year project at DYPCET, Kolhapur. Text messages and calls are simulated unless real services are connected.':
    'DYPCET, कोल्हापुर में अंतिम वर्ष की परियोजना। जब तक असली सेवाएँ नहीं जोड़ी जातीं, संदेश और कॉल अनुकरणित हैं।',
  'Nothing to pay now: pay your driver {amount} after the ride, in cash or by UPI.':
    'अभी कुछ नहीं देना: सवारी के बाद अपने चालक को {amount} नकद या UPI से दें।',
  'You pay your driver directly after the ride, in cash or by UPI. VAYORA charges nothing.':
    'आप सवारी के बाद सीधे अपने चालक को नकद या UPI से भुगतान करते हैं। VAYORA कुछ नहीं लेता।',
  'Flexible and any time book you on another ride automatically. The price is the same.':
    'लचीला और कभी भी चुनने पर आपको अपने आप दूसरी सवारी पर बुक किया जाता है। कीमत वही रहती है।',
  'If you cancel now, you owe your driver the whole fare.':
    'यदि आप अभी रद्द करते हैं, तो पूरा किराया चालक को देना होगा।',
  'If you cancel now, you owe nothing. In {time} that rises to {next}.':
    'यदि आप अभी रद्द करते हैं, तो कुछ नहीं देना। {time} में यह बढ़कर {next} हो जाएगा।',
  'If you cancel now, you owe your driver {amount}. In {time} that rises to {next}.':
    'यदि आप अभी रद्द करते हैं, तो चालक को {amount} देने होंगे। {time} में यह बढ़कर {next} हो जाएगा।',
  '{amount} owed to your driver':
    'चालक को {amount} देने हैं',
  'paid by UPI':
    'UPI से चुकाया',
  'paid in cash':
    'नकद चुकाया',
  'The driver has until {time} to answer. After that the request closes and you owe nothing.':
    'चालक के पास जवाब देने के लिए {time} तक का समय है। उसके बाद अनुरोध बंद हो जाएगा और आपको कुछ नहीं देना।',
  'You owe your driver {amount}. You can book again once they mark it paid.':
    'आपको अपने चालक को {amount} देने हैं। उनके दर्ज करने के बाद आप फिर से बुक कर सकेंगे।',
  'Paid, and they will not mark it?':
    'भुगतान कर दिया, पर वे दर्ज नहीं कर रहे?',
  'Report it on their profile, and staff can clear it.':
    'उनकी प्रोफ़ाइल पर रिपोर्ट करें, कर्मचारी इसे हटा सकते हैं।',
  'How to pay your driver':
    'अपने चालक को कैसे भुगतान करें',
  'You owe {amount}. You can book again once your driver marks it paid.':
    'आपको {amount} देने हैं। आपके चालक के दर्ज करने के बाद आप फिर से बुक कर सकेंगे।',
  'See My bookings':
    'मेरी बुकिंग देखें',
  'You have not booked anything yet.':
    'आपने अभी कुछ बुक नहीं किया है।',
  'Paid to your drivers':
    'आपके चालकों को दिया',
  'Where it stands':
    'स्थिति',
  '{amount} paid':
    '{amount} चुकाए',
  'For':
    'किसलिए',
  'Paid to the driver':
    'चालक को दिया',
  'Paid directly to the driver, as the driver recorded it. VAYORA took no part of it and charged nothing.':
    'सीधे चालक को दिया, जैसा चालक ने दर्ज किया। VAYORA ने इसमें से कुछ नहीं लिया और कोई शुल्क नहीं लगाया।',
  'Your seat is held while you decide. Many drivers confirm at once; the others answer your request. You pay your driver after the ride.':
    'निर्णय लेते समय आपकी सीट रोकी रहती है। कई चालक तुरंत पक्का करते हैं; बाकी आपके अनुरोध का उत्तर देते हैं। आप सवारी के बाद अपने चालक को भुगतान करते हैं।',
  '{n} rides cancelled. Every passenger has been told, and owes nothing.':
    '{n} सवारियाँ रद्द की गईं। हर यात्री को बता दिया गया है, और उन्हें कुछ नहीं देना।',
  // Getting started, for a new driver
  'Get set up':
    'शुरुआत करें',
  '{done} of {all} done':
    '{all} में से {done} पूरे',
  'Add your car':
    'अपनी कार जोड़ें',
  'Add your UPI ID or QR code, so passengers can pay you':
    'अपनी UPI आईडी या QR कोड जोड़ें, ताकि यात्री आपको भुगतान कर सकें',
  'Confirm your email or phone':
    'अपना ईमेल या फ़ोन पक्का करें',
  'Publish your first ride':
    'अपनी पहली सवारी प्रकाशित करें',
  '{step}: done':
    '{step}: पूरा',
  // Easier on a phone: search summary, booking tiles, publish and account
  'Enter a price, or 0 for a free ride':
    'कीमत दर्ज करें, या मुफ़्त सवारी के लिए 0',
  'Safety':
    'सुरक्षा',
  'None yet':
    'अभी कोई नहीं',
  '{n} contact':
    '{n} संपर्क',
  '{n} contacts':
    '{n} संपर्क',
  'Not declared':
    'घोषित नहीं',
  'QR code':
    'QR कोड',
  'Cash only':
    'केवल नकद',
  'App':
    'ऐप',
  "{when}, in your device's local time":
    '{when}, आपके डिवाइस के स्थानीय समय में',
  'Optional':
    'वैकल्पिक',
  'About {km} km in a straight line':
    'सीधी रेखा में लगभग {km} किमी',
  'You can start it from {time}':
    'आप इसे {time} से शुरू कर सकते हैं',
  '{n} seat':
    '{n} सीट',
  '{n} seats':
    '{n} सीटें',
  '{n} filters on':
    '{n} फ़िल्टर लगे हैं',
  'Change search':
    'खोज बदलें',
  'Picks you up where you start':
    'आप जहाँ से चलते हैं, वहीं से लेता है',
  'Pickup {pickup} from your start':
    'पिकअप आपके शुरुआती स्थान से {pickup} दूर',
  'drops you where you are going':
    'जहाँ जाना है, वहीं छोड़ता है',
  'drop-off {dropoff} from your destination':
    'ड्रॉप आपके गंतव्य से {dropoff} दूर',
  'What cancelling costs':
    'रद्द करने का खर्च',
  // Publishing route first: the route works itself out and fills the times and prices
  'Times and price per seat':
    'समय और प्रति सीट कीमत',
  'Filled in from the route as soon as it is worked out. Change any of them: what you type is kept.':
    'मार्ग निकलते ही ये उससे भर दिए जाते हैं। इनमें से कोई भी बदलें: आप जो लिखेंगे, वही रहेगा।',
  'The route could not be worked out by itself. Enter the times and prices, or try again.':
    'मार्ग अपने आप नहीं निकल सका। समय और कीमतें खुद भरें, या फिर से कोशिश करें।',
  // The assistant: what it says, the questions it starts from, and intel's reasons
  'Assistant':
    'सहायक',
  'Ask how VAYORA works: booking, cancelling, paying your driver, safety. It cannot see your bookings or change anything.':
    'पूछिए कि VAYORA कैसे काम करता है: बुकिंग, रद्द करना, ड्राइवर को भुगतान, सुरक्षा। यह आपकी बुकिंग नहीं देख सकता और कुछ बदल नहीं सकता।',
  'What you type is sent to Anthropic, whose AI writes the answers. VAYORA keeps none of it. An answer can be wrong: check anything important on the screen it is about.':
    'आप जो लिखते हैं वह Anthropic को भेजा जाता है, जिसका AI जवाब लिखता है। VAYORA इसमें से कुछ नहीं रखता। जवाब गलत भी हो सकता है: कोई भी ज़रूरी बात उसी स्क्रीन पर जाँच लें जिसके बारे में वह है।',
  'The assistant is switched off on this server.':
    'इस सर्वर पर सहायक बंद है।',
  'Try asking':
    'ऐसे पूछकर देखें',
  'The assistant cannot help with that. Ask about how VAYORA works.':
    'सहायक इसमें मदद नहीं कर सकता। VAYORA कैसे काम करता है, इसके बारे में पूछें।',
  'Writing an answer…':
    'जवाब लिखा जा रहा है…',
  'Your question':
    'आपका सवाल',
  'Start over':
    'फिर से शुरू करें',
  'What does cancelling cost?':
    'रद्द करने पर कितना देना होगा?',
  'How do I pay my driver?':
    'मैं अपने ड्राइवर को भुगतान कैसे करूँ?',
  'What happens if my driver cancels?':
    'अगर मेरा ड्राइवर रद्द कर दे तो क्या होगा?',
  'What is a women-only ride?':
    'केवल महिला यात्रियों वाली राइड क्या है?',
  'How do I publish a ride?':
    'मैं राइड कैसे प्रकाशित करूँ?',
  'When can I start my ride?':
    'राइड कब शुरू की जा सकती है?',
  'How do passengers pay me?':
    'यात्री मुझे भुगतान कैसे करते हैं?',
  'What if a passenger does not turn up?':
    'अगर कोई यात्री न आए तो क्या होगा?',
  'The assistant is not set up on this server':
    'इस सर्वर पर सहायक सेट नहीं है',
  'The assistant is switched off on this server':
    'इस सर्वर पर सहायक बंद है',
  'The last message must be a question':
    'आखिरी संदेश एक सवाल होना चाहिए',
  'The assistant is not set up correctly on this server':
    'इस सर्वर पर सहायक ठीक से सेट नहीं है',
  'The assistant is busy. Try again in a minute.':
    'सहायक अभी व्यस्त है। एक मिनट में फिर कोशिश करें।',
  'The assistant cannot be reached just now. Try again later.':
    'सहायक तक अभी नहीं पहुँच पा रहे। बाद में फिर कोशिश करें।',
  'The assistant could not answer that. Try asking another way.':
    'सहायक इसका जवाब नहीं दे सका। किसी और तरह से पूछकर देखें।',
};
