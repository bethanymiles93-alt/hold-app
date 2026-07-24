# Release checklist

## Product

- Both journeys complete on iOS and Android
- Back navigation preserves expected state
- Empty states are understandable
- No accidental send path
- Share wording is technically accurate

## Accessibility

- Screen reader tested
- Dynamic text tested
- 200% text does not hide essential actions
- Contrast checked
- Touch targets checked
- Reduced motion respected
- Keyboard navigation checked on web

## Privacy and safety

- Privacy copy matches actual behaviour
- No message content in logs
- No hidden analytics
- No bulk address-book permission requested (picker-only, explicit per-contact selection; see privacy model for what's stored about Your Circle contacts)
- Data deletion behaviour documented
- “Not emergency support” language reviewed
- UK legal/privacy advice obtained before public launch

## Engineering

- Typecheck passes
- Tests pass
- Expo Doctor passes
- Production build succeeds
- Bundle identifiers confirmed
- App icons and splash assets approved
- Dependencies reviewed
- Secrets absent from repository

## Store readiness

- Privacy policy URL
- Support URL
- App-store screenshots
- Age rating
- Data-safety forms
- Subscription terms, if applicable
- Account deletion route, if accounts are introduced
