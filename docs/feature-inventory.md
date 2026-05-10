# Naukri Clear Feature Inventory

This inventory is based on three verified sources:

1. Live DOM snapshots from the public site in the in-app browser
2. The deployed frontend bundle and sitemap
3. Authenticated API inspection using the provided `SESSION` token

## Frontend Features

1. Marketing homepage with a quiet dark theme, serif-led hero, feature cards, persona sections, FAQs, and CTA loops
2. Google sign-in page at `/login`
3. Public blog index at `/blog`
4. Individual blog article pages at `/blog/[slug]`
5. Public privacy page at `/privacy-policy`
6. Public terms page at `/terms`
7. Dashboard route at `/dashboard`
8. Applications tracker at `/applications`
9. Application export flow at `/applications/export`
10. Application import flow at `/applications/import`
11. Application import preview at `/applications/import/preview`
12. Application import template download at `/applications/import/template`
13. Resume vault route at `/resumes`
14. Resume extraction route at `/resume/extract`
15. Resume report routes at `/resume/report` and `/resume/report/latest`
16. Cover letter and resume AI entry points exposed in the bundle
17. Settings page at `/settings`
18. Public profile pages at `/u/[slug]`
19. Community hub at `/community`
20. Resume reviews board at `/community/reviews`
21. Review creation flow at `/community/reviews/new`
22. Interview experiences board at `/community/experiences`
23. Experience creation flow at `/community/experiences/new`
24. Referrals board at `/community/referrals`
25. Referral creation flow at `/community/referrals/new`
26. Referral profile-check flow at `/community/referrals/profile-check`
27. Q&A board at `/community/ask`
28. Ask-question flow at `/community/ask/new`
29. Ask tag pages at `/community/ask/tags/[tag]`
30. Community sorting and filtering controls for reviews, experiences, referrals, and ask
31. Browser extension onboarding via blog content and Settings-generated token flow
32. Public theme support with stored theme preference and system fallback

## Backend Features

1. Google OAuth2 login through `https://api.naukriclear.com/oauth2/authorization/google`
2. Session-cookie authentication with the `SESSION` cookie on the `naukriclear.com` domain
3. Current-user identity endpoint at `/api/me`
4. User name update endpoint at `/api/me/name`
5. User timezone update endpoint at `/api/me/timezone`
6. API token endpoint at `/api/me/api-token`
7. Dashboard analytics endpoint at `/api/analytics/dashboard`
8. Applications API at `/api/applications`
9. Application export endpoint at `/api/applications/export`
10. Application import endpoint at `/api/applications/import`
11. Application import preview endpoint at `/api/applications/import/preview`
12. Application import template endpoint at `/api/applications/import/template`
13. Resume list API at `/api/resumes`
14. Resume upload URL endpoint at `/api/resumes/upload-url`
15. Resume extraction endpoint at `/api/resume/extract`
16. AI resume report endpoint at `/api/ai/resume/report`
17. Latest AI resume report endpoint at `/api/ai/resume/report/latest`
18. AI cover-letter endpoint at `/api/ai/cover-letter`
19. AI usage accounting endpoint at `/api/ai/usage`
20. Cover-letter list API at `/api/cover-letters`
21. Cover-letter upload URL endpoint at `/api/cover-letters/upload-url`
22. Notes API at `/api/notes`
23. Note categories API at `/api/notes/categories`
24. Profile root API at `/api/profile`
25. Profile education subresource at `/api/profile/educations`
26. Profile experience subresource at `/api/profile/experiences`
27. Profile project subresource at `/api/profile/projects`
28. Profile skills subresource at `/api/profile/skills`
29. Profile slug endpoint at `/api/profile/slug`
30. Profile visibility endpoint at `/api/profile/visibility`
31. Public profile endpoint family at `/api/public/profile/*`
32. Public analytics endpoint family at `/api/public/analytics/*`
33. Recruiter management API at `/api/recruiters`
34. Community recruiters API at `/api/community/recruiters`
35. Community recruiter admin import endpoints at `/api/community/recruiters/admin/import` and `/preview`
36. Community recruiter admin report queue at `/api/community/recruiters/admin/reported`
37. Community reviews API at `/api/community/reviews`
38. Review image upload URL endpoint at `/api/community/reviews/image-upload-url`
39. Interview experiences API at `/api/community/experiences`
40. Referrals API at `/api/community/referrals`
41. Referral profile-check endpoint at `/api/community/referrals/profile-check`
42. Q&A API at `/api/community/ask`
43. Ask-tag API at `/api/community/ask/tags`
44. Comments API at `/api/community/comments`
45. Votes API at `/api/community/votes`
46. Reports API at `/api/community/reports`
47. Template library API at `/api/templates`
48. Feedback endpoint at `/api/feedback`
49. Billing status endpoint at `/api/payment/status`
50. Subscription creation endpoint at `/api/payment/create-subscription`
51. Subscription verification endpoint at `/api/payment/verify`
52. Subscription cancellation endpoint at `/api/payment/cancel-subscription`

## Notes On Confidence

- Verified directly from live responses: `/api/me`, `/api/analytics/dashboard`, `/api/applications`, `/api/resumes`, `/api/notes`, `/api/profile`, `/api/cover-letters`, `/api/ai/usage`, `/api/payment/status`, `/api/community/experiences`, `/api/community/reviews`, `/api/community/referrals`, `/api/community/ask/tags`
- Verified from shipped frontend route or endpoint strings: the remaining routes and endpoints listed above
- Not implemented in the clone UI yet: every deep create/edit/admin flow listed above
