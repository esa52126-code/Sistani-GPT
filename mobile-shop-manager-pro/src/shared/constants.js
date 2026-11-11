/* Reference data shared by main and renderer: currencies, countries, categories. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Const = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // code|symbol|name|decimals
  const CURRENCIES = `USD|$|US Dollar|2
EUR|€|Euro|2
GBP|£|British Pound|2
CAD|CA$|Canadian Dollar|2
AUD|A$|Australian Dollar|2
NZD|NZ$|New Zealand Dollar|2
AED|AED|UAE Dirham|2
SAR|SAR|Saudi Riyal|2
QAR|QAR|Qatari Riyal|2
KWD|KD|Kuwaiti Dinar|3
BHD|BD|Bahraini Dinar|3
OMR|OMR|Omani Rial|3
PKR|Rs.|Pakistani Rupee|0
INR|₹|Indian Rupee|2
BDT|৳|Bangladeshi Taka|2
LKR|Rs|Sri Lankan Rupee|2
NPR|Rs|Nepalese Rupee|2
AFN|؋|Afghan Afghani|2
CHF|CHF|Swiss Franc|2
SEK|kr|Swedish Krona|2
NOK|kr|Norwegian Krone|2
DKK|kr|Danish Krone|2
PLN|zł|Polish Zloty|2
CZK|Kč|Czech Koruna|2
HUF|Ft|Hungarian Forint|0
RON|lei|Romanian Leu|2
BGN|лв|Bulgarian Lev|2
TRY|₺|Turkish Lira|2
RUB|₽|Russian Ruble|2
UAH|₴|Ukrainian Hryvnia|2
JPY|¥|Japanese Yen|0
CNY|CN¥|Chinese Yuan|2
HKD|HK$|Hong Kong Dollar|2
SGD|S$|Singapore Dollar|2
MYR|RM|Malaysian Ringgit|2
IDR|Rp|Indonesian Rupiah|0
THB|฿|Thai Baht|2
VND|₫|Vietnamese Dong|0
PHP|₱|Philippine Peso|2
KRW|₩|South Korean Won|0
ZAR|R|South African Rand|2
NGN|₦|Nigerian Naira|2
KES|KSh|Kenyan Shilling|2
GHS|GH₵|Ghanaian Cedi|2
EGP|E£|Egyptian Pound|2
MAD|MAD|Moroccan Dirham|2
TZS|TSh|Tanzanian Shilling|0
UGX|USh|Ugandan Shilling|0
ETB|Br|Ethiopian Birr|2
MXN|MX$|Mexican Peso|2
BRL|R$|Brazilian Real|2
ARS|AR$|Argentine Peso|2
CLP|CLP$|Chilean Peso|0
COP|COL$|Colombian Peso|0
PEN|S/|Peruvian Sol|2
ILS|₪|Israeli Shekel|2
JOD|JD|Jordanian Dinar|3
IQD|IQD|Iraqi Dinar|0
IRR|IRR|Iranian Rial|0`.split('\n').map(l => { const [code, symbol, name, decimals] = l.split('|'); return { code, symbol, name, decimals: +decimals }; });

  // iso|name|dial code|default currency
  const COUNTRIES = `AF|Afghanistan|93|AFN
AL|Albania|355|EUR
DZ|Algeria|213|USD
AD|Andorra|376|EUR
AO|Angola|244|USD
AG|Antigua and Barbuda|1|USD
AR|Argentina|54|ARS
AM|Armenia|374|USD
AU|Australia|61|AUD
AT|Austria|43|EUR
AZ|Azerbaijan|994|USD
BS|Bahamas|1|USD
BH|Bahrain|973|BHD
BD|Bangladesh|880|BDT
BB|Barbados|1|USD
BY|Belarus|375|USD
BE|Belgium|32|EUR
BZ|Belize|501|USD
BJ|Benin|229|USD
BT|Bhutan|975|INR
BO|Bolivia|591|USD
BA|Bosnia and Herzegovina|387|EUR
BW|Botswana|267|USD
BR|Brazil|55|BRL
BN|Brunei|673|SGD
BG|Bulgaria|359|BGN
BF|Burkina Faso|226|USD
BI|Burundi|257|USD
KH|Cambodia|855|USD
CM|Cameroon|237|USD
CA|Canada|1|CAD
CV|Cape Verde|238|USD
CF|Central African Republic|236|USD
TD|Chad|235|USD
CL|Chile|56|CLP
CN|China|86|CNY
CO|Colombia|57|COP
KM|Comoros|269|USD
CG|Congo|242|USD
CD|Congo (DRC)|243|USD
CR|Costa Rica|506|USD
CI|Côte d'Ivoire|225|USD
HR|Croatia|385|EUR
CU|Cuba|53|USD
CY|Cyprus|357|EUR
CZ|Czechia|420|CZK
DK|Denmark|45|DKK
DJ|Djibouti|253|USD
DM|Dominica|1|USD
DO|Dominican Republic|1|USD
EC|Ecuador|593|USD
EG|Egypt|20|EGP
SV|El Salvador|503|USD
GQ|Equatorial Guinea|240|USD
ER|Eritrea|291|USD
EE|Estonia|372|EUR
SZ|Eswatini|268|ZAR
ET|Ethiopia|251|ETB
FJ|Fiji|679|USD
FI|Finland|358|EUR
FR|France|33|EUR
GA|Gabon|241|USD
GM|Gambia|220|USD
GE|Georgia|995|USD
DE|Germany|49|EUR
GH|Ghana|233|GHS
GR|Greece|30|EUR
GD|Grenada|1|USD
GT|Guatemala|502|USD
GN|Guinea|224|USD
GW|Guinea-Bissau|245|USD
GY|Guyana|592|USD
HT|Haiti|509|USD
HN|Honduras|504|USD
HK|Hong Kong|852|HKD
HU|Hungary|36|HUF
IS|Iceland|354|EUR
IN|India|91|INR
ID|Indonesia|62|IDR
IR|Iran|98|IRR
IQ|Iraq|964|IQD
IE|Ireland|353|EUR
IL|Israel|972|ILS
IT|Italy|39|EUR
JM|Jamaica|1|USD
JP|Japan|81|JPY
JO|Jordan|962|JOD
KZ|Kazakhstan|7|USD
KE|Kenya|254|KES
KI|Kiribati|686|AUD
KW|Kuwait|965|KWD
KG|Kyrgyzstan|996|USD
LA|Laos|856|USD
LV|Latvia|371|EUR
LB|Lebanon|961|USD
LS|Lesotho|266|ZAR
LR|Liberia|231|USD
LY|Libya|218|USD
LI|Liechtenstein|423|CHF
LT|Lithuania|370|EUR
LU|Luxembourg|352|EUR
MO|Macau|853|HKD
MG|Madagascar|261|USD
MW|Malawi|265|USD
MY|Malaysia|60|MYR
MV|Maldives|960|USD
ML|Mali|223|USD
MT|Malta|356|EUR
MH|Marshall Islands|692|USD
MR|Mauritania|222|USD
MU|Mauritius|230|USD
MX|Mexico|52|MXN
FM|Micronesia|691|USD
MD|Moldova|373|EUR
MC|Monaco|377|EUR
MN|Mongolia|976|USD
ME|Montenegro|382|EUR
MA|Morocco|212|MAD
MZ|Mozambique|258|USD
MM|Myanmar|95|USD
NA|Namibia|264|ZAR
NR|Nauru|674|AUD
NP|Nepal|977|NPR
NL|Netherlands|31|EUR
NZ|New Zealand|64|NZD
NI|Nicaragua|505|USD
NE|Niger|227|USD
NG|Nigeria|234|NGN
KP|North Korea|850|USD
MK|North Macedonia|389|EUR
NO|Norway|47|NOK
OM|Oman|968|OMR
PK|Pakistan|92|PKR
PW|Palau|680|USD
PS|Palestine|970|ILS
PA|Panama|507|USD
PG|Papua New Guinea|675|USD
PY|Paraguay|595|USD
PE|Peru|51|PEN
PH|Philippines|63|PHP
PL|Poland|48|PLN
PT|Portugal|351|EUR
PR|Puerto Rico|1|USD
QA|Qatar|974|QAR
RO|Romania|40|RON
RU|Russia|7|RUB
RW|Rwanda|250|USD
KN|Saint Kitts and Nevis|1|USD
LC|Saint Lucia|1|USD
VC|Saint Vincent and the Grenadines|1|USD
WS|Samoa|685|USD
SM|San Marino|378|EUR
ST|São Tomé and Príncipe|239|USD
SA|Saudi Arabia|966|SAR
SN|Senegal|221|USD
RS|Serbia|381|EUR
SC|Seychelles|248|USD
SL|Sierra Leone|232|USD
SG|Singapore|65|SGD
SK|Slovakia|421|EUR
SI|Slovenia|386|EUR
SB|Solomon Islands|677|USD
SO|Somalia|252|USD
ZA|South Africa|27|ZAR
KR|South Korea|82|KRW
SS|South Sudan|211|USD
ES|Spain|34|EUR
LK|Sri Lanka|94|LKR
SD|Sudan|249|USD
SR|Suriname|597|USD
SE|Sweden|46|SEK
CH|Switzerland|41|CHF
SY|Syria|963|USD
TW|Taiwan|886|USD
TJ|Tajikistan|992|USD
TZ|Tanzania|255|TZS
TH|Thailand|66|THB
TL|Timor-Leste|670|USD
TG|Togo|228|USD
TO|Tonga|676|USD
TT|Trinidad and Tobago|1|USD
TN|Tunisia|216|USD
TR|Türkiye|90|TRY
TM|Turkmenistan|993|USD
TV|Tuvalu|688|AUD
UG|Uganda|256|UGX
UA|Ukraine|380|UAH
AE|United Arab Emirates|971|AED
GB|United Kingdom|44|GBP
US|United States|1|USD
UY|Uruguay|598|USD
UZ|Uzbekistan|998|USD
VU|Vanuatu|678|USD
VA|Vatican City|39|EUR
VE|Venezuela|58|USD
VN|Vietnam|84|VND
YE|Yemen|967|USD
ZM|Zambia|260|USD
ZW|Zimbabwe|263|USD`.split('\n').map(l => { const [iso, name, dial, currency] = l.split('|'); return { iso, name, dial: '+' + dial, currency }; });

  const ACCESSORY_CATEGORIES = ['chargers', 'cables', 'cases', 'screen_protectors', 'earphones', 'earbuds', 'power_banks', 'smart_watches', 'memory_cards', 'other'];
  const ACCESSORY_CATEGORY_LABELS = { chargers: 'Chargers', cables: 'Cables', cases: 'Phone cases', screen_protectors: 'Screen protectors', earphones: 'Earphones', earbuds: 'Earbuds', power_banks: 'Power banks', smart_watches: 'Smart watches', memory_cards: 'Memory cards', other: 'Other accessories' };
  const EXPENSE_CATEGORIES = ['rent', 'electricity', 'internet', 'salaries', 'transport', 'repairs', 'marketing', 'other'];
  const EXPENSE_CATEGORY_LABELS = { rent: 'Rent', electricity: 'Electricity', internet: 'Internet', salaries: 'Salaries', transport: 'Transport', repairs: 'Repairs', marketing: 'Marketing', other: 'Other' };
  const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'mobile_wallet', 'other'];
  const PAYMENT_METHOD_LABELS = { cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card', mobile_wallet: 'Mobile wallet', other: 'Other', exchange: 'Trade-in' };
  const MOBILE_STATUSES = ['in_stock', 'sold', 'exchange', 'returned'];
  const MOBILE_STATUS_LABELS = { in_stock: 'In Stock', sold: 'Sold', exchange: 'Exchange', returned: 'Returned' };
  const USED_STATUSES = ['available', 'sold', 'returned'];
  const USED_STATUS_LABELS = { available: 'Available', sold: 'Sold', returned: 'Returned' };
  const CONDITIONS = ['like_new', 'excellent', 'good', 'fair', 'poor', 'faulty'];
  const CONDITION_LABELS = { like_new: 'Like new', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', faulty: 'Faulty / for parts' };
  const LANGUAGES = [
    { code: 'en', name: 'English', rtl: false }, { code: 'ur', name: 'اردو (Urdu)', rtl: true },
    { code: 'ar', name: 'العربية (Arabic)', rtl: true }, { code: 'es', name: 'Español (Spanish)', rtl: false },
    { code: 'fr', name: 'Français (French)', rtl: false }, { code: 'de', name: 'Deutsch (German)', rtl: false },
    { code: 'hi', name: 'हिन्दी (Hindi)', rtl: false },
  ];
  const TIMEZONES = ['system', 'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
    'America/Toronto', 'America/Vancouver', 'America/Halifax', 'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Santiago',
    'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Zurich', 'Europe/Vienna',
    'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Warsaw', 'Europe/Prague', 'Europe/Budapest', 'Europe/Bucharest', 'Europe/Athens', 'Europe/Helsinki', 'Europe/Kyiv', 'Europe/Istanbul', 'Europe/Moscow',
    'Africa/Cairo', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg', 'Africa/Casablanca', 'Africa/Accra',
    'Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kuwait', 'Asia/Bahrain', 'Asia/Muscat', 'Asia/Baghdad', 'Asia/Tehran', 'Asia/Jerusalem', 'Asia/Amman',
    'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Colombo', 'Asia/Kathmandu', 'Asia/Kabul', 'Asia/Tashkent',
    'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Ho_Chi_Minh', 'Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Manila', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Taipei', 'Asia/Seoul', 'Asia/Tokyo',
    'Australia/Perth', 'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland', 'Pacific/Fiji'];
  const TAX_LABELS = ['Tax', 'Sales Tax', 'VAT', 'GST', 'HST', 'IVA', 'TVA', 'MwSt'];

  return { CURRENCIES, COUNTRIES, ACCESSORY_CATEGORIES, ACCESSORY_CATEGORY_LABELS, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS,
    PAYMENT_METHODS, PAYMENT_METHOD_LABELS, MOBILE_STATUSES, MOBILE_STATUS_LABELS, USED_STATUSES, USED_STATUS_LABELS,
    CONDITIONS, CONDITION_LABELS, LANGUAGES, TIMEZONES, TAX_LABELS };
});
