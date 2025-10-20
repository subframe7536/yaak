import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { memo } from 'react';
import { hoveredParentDepthFamily, isParentHoveredFamily } from './atoms';

export const TreeIndentGuide = memo(function TreeIndentGuide({
  treeId,
  depth,
  parentId,
}: {
  treeId: string;
  depth: number;
  parentId: string | null;
}) {
  const parentDepth = useAtomValue(hoveredParentDepthFamily(treeId));
  const isHovered = useAtomValue(isParentHoveredFamily({ treeId, parentId }));

  return (
    <div className="flex">
      {Array.from({ length: depth }).map((_, i) => (
        <div
          key={i}
          className={classNames(
            'w-[1rem] border-r border-r-text-subtlest',
            !(parentDepth === i + 1 && isHovered) && 'opacity-30',
          )}
        />
      ))}
    </div>
  );
});
