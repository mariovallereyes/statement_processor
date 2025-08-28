# IFrame Upload Revert Plan

## If IFrame Solution Fails

### Quick Revert Steps:

1. **Restore Original Component**:
   ```bash
   # In App.tsx, change line 772:
   # FROM: <IFrameUpload
   # TO:   <ExtensionProofUpload
   ```

2. **Files to Remove**:
   ```bash
   rm public/upload-iframe.html
   rm src/components/FileUpload/IFrameUpload.tsx
   rm REVERT_PLAN.md
   ```

3. **Import to Restore**:
   ```typescript
   // In App.tsx, change line 14:
   // FROM: import { IFrameUpload } from './components/FileUpload/IFrameUpload';
   // TO:   import { ExtensionProofUpload } from './components/FileUpload/ExtensionProofUpload';
   ```

### Alternative Fallback Options:

1. **Use Original FileUpload**: Remove extension protection entirely
2. **Use FallbackFileUpload**: Simple but works everywhere
3. **Add user instructions**: Guide users to use incognito mode

### Files Added in This Solution:
- `/public/upload-iframe.html` (new)
- `/src/components/FileUpload/IFrameUpload.tsx` (new)
- `REVERT_PLAN.md` (this file)

### Files Modified:
- `/src/App.tsx` (lines 14 and 772-776)

### No Breaking Changes:
- Same API interface as ExtensionProofUpload
- Same onFileSelect/onError callbacks
- Maintains exact same functionality