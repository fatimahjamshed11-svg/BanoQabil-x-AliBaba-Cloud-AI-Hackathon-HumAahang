export const judgeAccessRows = `
Opening Hum Ahang…|ہم آہنگ کھل رہی ہے…|Hum Ahang khul rahi hai…
Couldn’t connect to online features|آن لائن سہولتوں سے رابطہ نہیں ہو سکا|Online sahulaton se raabta nahin ho saka
Continue to the app|ایپ میں جائیں|App mein jaayein
No camera or microphone starts automatically.|کیمرا یا مائیک خود بخود شروع نہیں ہوتا۔|Camera ya mic khud bakhud shuru nahin hota.
Hum Ahang logo|ہم آہنگ کا لوگو|Hum Ahang ka logo
Retry secure connection|محفوظ رابطہ دوبارہ آزمائیں|Mehfooz raabta dobara aazmayen
Open the private demo link provided by the project team. No terminal or pairing code is needed.|منصوبے کی ٹیم کا دیا ہوا خصوصی نمائش کا ربط کھولیں۔ ٹرمینل یا رابطے کے کوڈ کی ضرورت نہیں۔|Mansoobe ki team ka diya hua khusoosi numaish ka link kholein. Terminal ya raabte ke code ki zaroorat nahin.
This demo link is expired or incorrect. Ask the project team for an updated link.|نمائش کا یہ ربط غلط ہے یا اس کی مدت ختم ہو گئی ہے۔ منصوبے کی ٹیم سے نیا ربط مانگیں۔|Numaish ka yeh link ghalat hai ya is ki muddat khatam ho gayi hai. Mansoobe ki team se naya link maangein.
Judge access is not available right now. Please contact the project team.|منصفین کی رسائی اس وقت دستیاب نہیں۔ منصوبے کی ٹیم سے رابطہ کریں۔|Munsifeen ki rasai is waqt dastiyab nahin. Mansoobe ki team se raabta karein.
The demo is busy or its access limit has been reached. Please retry shortly or contact the project team.|نمائش مصروف ہے یا رسائی کی حد پوری ہو گئی ہے۔ کچھ دیر بعد دوبارہ کوشش کریں یا منصوبے کی ٹیم سے رابطہ کریں۔|Numaish masroof hai ya rasai ki hadd poori ho gayi hai. Kuch dair baad dobara koshish karein ya mansoobe ki team se raabta karein.
Cannot reach the demo service. Check your internet connection and retry.|نمائش کی سروس سے رابطہ نہیں ہو سکا۔ انٹرنیٹ کا رابطہ چیک کر کے دوبارہ کوشش کریں۔|Numaish ki service se raabta nahin ho saka. Internet ka raabta check kar ke dobara koshish karein.
The demo service could not establish a safe connection. Please retry.|نمائش کی سروس محفوظ رابطہ قائم نہیں کر سکی۔ دوبارہ کوشش کریں۔|Numaish ki service mehfooz raabta qaim nahin kar saki. Dobara koshish karein.
`.trim().split('\n').map(line => line.split('|'));
