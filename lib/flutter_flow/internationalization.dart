import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kLocaleStorageKey = '__locale_key__';

class FFLocalizations {
  FFLocalizations(this.locale);

  final Locale locale;

  static FFLocalizations of(BuildContext context) =>
      Localizations.of<FFLocalizations>(context, FFLocalizations)!;

  static List<String> languages() => ['ru', 'en'];

  static late SharedPreferences _prefs;
  static Future initialize() async =>
      _prefs = await SharedPreferences.getInstance();
  static Future storeLocale(String locale) =>
      _prefs.setString(_kLocaleStorageKey, locale);
  static Locale? getStoredLocale() {
    final locale = _prefs.getString(_kLocaleStorageKey);
    return locale != null && locale.isNotEmpty ? createLocale(locale) : null;
  }

  String get languageCode => locale.toString();
  String? get languageShortCode =>
      _languagesWithShortCode.contains(locale.toString())
          ? '${locale.toString()}_short'
          : null;
  int get languageIndex => languages().contains(languageCode)
      ? languages().indexOf(languageCode)
      : 0;

  String getText(String key) =>
      (kTranslationsMap[key] ?? {})[locale.toString()] ?? '';

  String getVariableText({
    String? ruText = '',
    String? enText = '',
  }) =>
      [ruText, enText][languageIndex] ?? '';

  static const Set<String> _languagesWithShortCode = {
    'ar',
    'az',
    'ca',
    'cs',
    'da',
    'de',
    'dv',
    'en',
    'es',
    'et',
    'fi',
    'fr',
    'gr',
    'he',
    'hi',
    'hu',
    'it',
    'km',
    'ku',
    'mn',
    'ms',
    'no',
    'pt',
    'ro',
    'ru',
    'rw',
    'sv',
    'th',
    'uk',
    'vi',
  };
}

/// Used if the locale is not supported by GlobalMaterialLocalizations.
class FallbackMaterialLocalizationDelegate
    extends LocalizationsDelegate<MaterialLocalizations> {
  const FallbackMaterialLocalizationDelegate();

  @override
  bool isSupported(Locale locale) => _isSupportedLocale(locale);

  @override
  Future<MaterialLocalizations> load(Locale locale) async =>
      SynchronousFuture<MaterialLocalizations>(
        const DefaultMaterialLocalizations(),
      );

  @override
  bool shouldReload(FallbackMaterialLocalizationDelegate old) => false;
}

/// Used if the locale is not supported by GlobalCupertinoLocalizations.
class FallbackCupertinoLocalizationDelegate
    extends LocalizationsDelegate<CupertinoLocalizations> {
  const FallbackCupertinoLocalizationDelegate();

  @override
  bool isSupported(Locale locale) => _isSupportedLocale(locale);

  @override
  Future<CupertinoLocalizations> load(Locale locale) =>
      SynchronousFuture<CupertinoLocalizations>(
        const DefaultCupertinoLocalizations(),
      );

  @override
  bool shouldReload(FallbackCupertinoLocalizationDelegate old) => false;
}

class FFLocalizationsDelegate extends LocalizationsDelegate<FFLocalizations> {
  const FFLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => _isSupportedLocale(locale);

  @override
  Future<FFLocalizations> load(Locale locale) =>
      SynchronousFuture<FFLocalizations>(FFLocalizations(locale));

  @override
  bool shouldReload(FFLocalizationsDelegate old) => false;
}

Locale createLocale(String language) => language.contains('_')
    ? Locale.fromSubtags(
        languageCode: language.split('_').first,
        scriptCode: language.split('_').last,
      )
    : Locale(language);

bool _isSupportedLocale(Locale locale) {
  final language = locale.toString();
  return FFLocalizations.languages().contains(
    language.endsWith('_')
        ? language.substring(0, language.length - 1)
        : language,
  );
}

final kTranslationsMap = <Map<String, Map<String, String>>>[
  // LoginPage
  {
    'jjee1l7x': {
      'ru': 'Добро пожаловать в ',
      'en': 'Welcome to ',
    },
    '2uosp4hu': {
      'ru': 'Giftspy',
      'en': 'Giftspy',
    },
    '6r43b9mf': {
      'ru': 'Giftspy',
      'en': 'Giftspy',
    },
    'gvcswxml': {
      'ru': 'Узнайте, чего хотят ваши друзья, оставаясь в тени',
      'en': 'Find out what your friends want without killing the surprise',
    },
    'vtqvshmm': {
      'ru': '+7',
      'en': '+7',
    },
    'p7fhadvb': {
      'ru': 'Номер телефона',
      'en': 'Phone number',
    },
    'rcjae5m5': {
      'ru': 'Войти',
      'en': 'Log in',
    },
    'f3tpoipm': {
      'ru': 'Нажимая \"Войти\", вы соглашаетесь на ',
      'en': 'By tapping \"Create account\" you agree to ',
    },
    'n1u3z6c1': {
      'ru': 'политику конфиденциальности ',
      'en': 'Privacy Policy',
    },
    'jvhi0wh2': {
      'ru': 'Home',
      'en': '',
    },
  },
  // OTPConfirmPage
  {
    'b6ho3fon': {
      'ru': 'Введите код из SMS',
      'en': 'Enter SMS code',
    },
    'ych19fed': {
      'ru': 'Мы только что отправили 4-х значный код на ваш номер телефона',
      'en': 'We just sent you an 4 digits code on your phone number',
    },
    'w7zobyey': {
      'ru': 'Home',
      'en': 'Home',
    },
  },
  // test
  {
    'lr02ejut': {
      'ru': 'Ask me anything...',
      'en': '',
    },
    'tpnybsv9': {
      'ru': 'Home',
      'en': 'Home',
    },
  },
  // OnBoardingPage
  {
    'rg0o718x': {
      'ru': 'Giftspy',
      'en': '',
    },
    '9b20isyx': {
      'ru': 'Знакомьтесь — Детектив!',
      'en': '',
    },
    'aaqdl0l1': {
      'ru': 'В нашем штате их много. Они помогут вам узнать, чего хотят друзья',
      'en': '',
    },
    's9ahma34': {
      'ru': 'Отправьте его на задание',
      'en': '',
    },
    'lxdww2qj': {
      'ru':
          'Может общаться через популярные мессенджеры, такие как WhatsApp и Telegram',
      'en': '',
    },
    '1muci3kt': {
      'ru': 'Справятся со всем',
      'en': '',
    },
    'krjoo983': {
      'ru':
          'Это может быть день рождения, выпускной или любой другой праздник. А можно послать и просто так',
      'en': '',
    },
    'j50bh923': {
      'ru': 'Продолжить',
      'en': '',
    },
    'uxl6lwoi': {
      'ru': 'Home',
      'en': 'Home',
    },
  },
  // HomePage
  {
    'rk9z72uh': {
      'ru': 'Giftspy',
      'en': 'Giftspy',
    },
    'deqwaqbq': {
      'ru': 'Найдите идеальный подарок',
      'en': 'Search for the perfect gift',
    },
    '4mqatm1e': {
      'ru': 'Современный телефон с поддержкой NFC',
      'en': 'Modern phones with NFC technology',
    },
    'w72tsz5x': {
      'ru': 'Home',
      'en': 'Home',
    },
  },
  // MissionPage
  {
    'qndy2ymw': {
      'ru': 'Giftspy',
      'en': '',
    },
    '32vhphap': {
      'ru': 'Home',
      'en': 'Home',
    },
  },
  // test2
  {
    'l6lvjb3a': {
      'ru': 'Giftspy - ',
      'en': '',
    },
    'nnz7lzw5': {
      'ru': 'Задания',
      'en': '',
    },
    'bw0jn37i': {
      'ru': 'Home',
      'en': 'Home',
    },
  },
  // NavBar
  {
    'g0osur7n': {
      'ru': 'Главная',
      'en': '',
    },
    'g4lsks1n': {
      'ru': 'Задания',
      'en': '',
    },
    'wz5p6x2x': {
      'ru': 'Подарки',
      'en': '',
    },
  },
  // Miscellaneous
  {
    'lgua31tk': {
      'ru': '',
      'en': '',
    },
    'pmo9dog5': {
      'ru': '',
      'en': '',
    },
    '6ydz6ev1': {
      'ru': '',
      'en': '',
    },
    'ihi2qa0x': {
      'ru': '',
      'en': '',
    },
    'z0gqbjkl': {
      'ru': '',
      'en': '',
    },
    'frniiu4g': {
      'ru': '',
      'en': '',
    },
    'yimndx4r': {
      'ru': '',
      'en': '',
    },
    'cqwnhiec': {
      'ru': '',
      'en': '',
    },
    'bghak8s9': {
      'ru': '',
      'en': '',
    },
    'eg91qu9c': {
      'ru': '',
      'en': '',
    },
    'ki8znvja': {
      'ru': '',
      'en': '',
    },
    '5y2dmfvd': {
      'ru': '',
      'en': '',
    },
    'jchvatnl': {
      'ru': '',
      'en': '',
    },
    'rvadiwwd': {
      'ru': '',
      'en': '',
    },
    's4nltzxa': {
      'ru': '',
      'en': '',
    },
    'pch39rwz': {
      'ru': '',
      'en': '',
    },
    'nxl3b46k': {
      'ru': '',
      'en': '',
    },
    'e67kn25k': {
      'ru': '',
      'en': '',
    },
    'x3ak6uh6': {
      'ru': '',
      'en': '',
    },
    'kcis3a52': {
      'ru': '',
      'en': '',
    },
    'dapji01i': {
      'ru': '',
      'en': '',
    },
    '30bpdslz': {
      'ru': '',
      'en': '',
    },
    '0wfwuopw': {
      'ru': '',
      'en': '',
    },
    'keuv3p0b': {
      'ru': '',
      'en': '',
    },
    'g2muopd3': {
      'ru': '',
      'en': '',
    },
  },
].reduce((a, b) => a..addAll(b));
