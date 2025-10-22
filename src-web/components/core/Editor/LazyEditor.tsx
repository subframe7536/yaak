import type { EditorView } from '@codemirror/view';
import { forwardRef, lazy, Suspense } from 'react';
import type { EditorProps } from './Editor';

const Editor_ = lazy(() => import('./Editor').then((m) => ({ default: m.Editor })));

export const Editor = forwardRef<EditorView, EditorProps>(function LazyEditor(props, ref) {
  return (
    <Suspense>
      <Editor_ ref={ref} {...props} />
    </Suspense>
  );
});
