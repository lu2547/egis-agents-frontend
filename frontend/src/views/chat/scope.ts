import { computed, ref } from 'vue';
import { scopeGroups } from './constants';
import type { ScopeBadge, ScopeGroup, ScopeLibrary } from './types';

const collectLibraryTagIds = (library: ScopeLibrary) => {
  return library.tags.flatMap((tag) => [tag.id, ...(tag.children?.map((child) => child.id) ?? [])]);
};

export const useScopeSelection = () => {
  const internetSearchEnabled = ref(true);
  const selectedScopeIds = ref<string[]>([]);
  const selectedTagIds = ref<string[]>([]);
  const selectedFileIds = ref<string[]>([]);
  const activeScopeLibraryId = ref('public-policy');
  const scopeSearchKeyword = ref('');

  const allScopeLibraries = computed(() => scopeGroups.flatMap((group) => group.libraries));
  const selectedScopeLibraries = computed(() => allScopeLibraries.value.filter((library) => selectedScopeIds.value.includes(library.id)));
  const activeScopeLibrary = computed(() => {
    return allScopeLibraries.value.find((library) => library.id === activeScopeLibraryId.value) || selectedScopeLibraries.value[0] || allScopeLibraries.value[0];
  });

  const getLibraryByTagId = (tagId: string) => {
    return allScopeLibraries.value.find((library) => collectLibraryTagIds(library).includes(tagId));
  };

  const getLibraryByFileId = (fileId: string) => {
    return allScopeLibraries.value.find((library) => library.files.some((file) => file.id === fileId));
  };

  const isLibraryAllTagsSelected = (library: ScopeLibrary) => {
    const tagIds = collectLibraryTagIds(library);
    return selectedScopeIds.value.includes(library.id) && tagIds.length > 0 && tagIds.every((id) => selectedTagIds.value.includes(id));
  };

  const getSelectedLibraryTags = (library: ScopeLibrary) => {
    const tagIds = new Set(collectLibraryTagIds(library));
    return selectedTagIds.value.filter((id) => tagIds.has(id));
  };

  const getSelectedLibraryFiles = (library: ScopeLibrary) => {
    return library.files.filter((file) => selectedFileIds.value.includes(file.id));
  };

  const getTagNameMap = (library: ScopeLibrary) => {
    const entries = library.tags.flatMap((tag) => [
      [tag.id, tag.name] as const,
      ...(tag.children?.map((child) => [child.id, child.name] as const) ?? [])
    ]);
    return new Map(entries);
  };

  const getFileMatchedTagIds = (files: ScopeLibrary['files']) => {
    return new Set(files.map((file) => file.tagId).filter((id): id is string => Boolean(id)));
  };

  const isFileInSelectedTagScope = (library: ScopeLibrary, file: ScopeLibrary['files'][number], selectedTags: Set<string>) => {
    if (selectedTags.size === 0) return true;
    if (!file.tagId) return false;
    if (selectedTags.has(file.tagId)) return true;
    return library.tags.some((tag) => selectedTags.has(tag.id) && tag.children?.some((child) => child.id === file.tagId));
  };

  const activeLibrarySelectedTags = computed(() => getSelectedLibraryTags(activeScopeLibrary.value));

  const filteredActiveScopeFiles = computed(() => {
    const library = activeScopeLibrary.value;
    const keyword = scopeSearchKeyword.value.trim().toLowerCase();
    const selectedTags = new Set(activeLibrarySelectedTags.value);
    const tagNames = getTagNameMap(library);
    return library.files.filter((file) => {
      const matchesSelectedTag = isFileInSelectedTagScope(library, file, selectedTags);
      if (!matchesSelectedTag) return false;
      if (!keyword) return true;
      const tagName = file.tagId ? tagNames.get(file.tagId) ?? '' : '';
      return file.name.toLowerCase().includes(keyword) || tagName.toLowerCase().includes(keyword);
    });
  });

  const removeLibraryPreciseSelection = (libraryIds: string[]) => {
    const removedLibraries = allScopeLibraries.value.filter((library) => libraryIds.includes(library.id));
    const removedTagIds = new Set(removedLibraries.flatMap(collectLibraryTagIds));
    const removedFileIds = new Set(removedLibraries.flatMap((library) => library.files.map((file) => file.id)));
    selectedTagIds.value = selectedTagIds.value.filter((id) => !removedTagIds.has(id));
    selectedFileIds.value = selectedFileIds.value.filter((id) => !removedFileIds.has(id));
  };

  const scopeLabel = computed(() => {
    const selectedLibraryIds = new Set(selectedScopeIds.value);
    const selectedLibraries = allScopeLibraries.value.filter((library) => selectedLibraryIds.has(library.id));
    const selectedLibraryTagIds = new Set(selectedLibraries.flatMap(collectLibraryTagIds));
    const selectedLibraryFileIds = new Set(selectedLibraries.flatMap((library) => library.files.map((file) => file.id)));
    const hasVisiblePreciseSelection =
      selectedTagIds.value.some((id) => selectedLibraryTagIds.has(id)) ||
      selectedFileIds.value.some((id) => selectedLibraryFileIds.has(id));
    const hasSpecifiedMaterial = selectedScopeIds.value.length > 0 || hasVisiblePreciseSelection;
    return hasSpecifiedMaterial ? '已指定资料' : '资料范围';
  });

  const selectedScopeBadges = computed<ScopeBadge[]>(() => {
    const badges: ScopeBadge[] = [];
    for (const library of selectedScopeLibraries.value) {
      const files = getSelectedLibraryFiles(library);
      const selectedTags = getSelectedLibraryTags(library);
      const allTagIds = collectLibraryTagIds(library);
      if (files.length > 0) {
        const fileTagIds = getFileMatchedTagIds(files);
        files.forEach((file) => badges.push({
          key: `${library.id}:${file.id}`,
          text: `${file.name}(${library.name})`,
          libraryId: library.id,
          kind: 'file',
          fileId: file.id
        }));
        if (selectedTags.some((tagId) => !fileTagIds.has(tagId))) {
          badges.push({ key: `${library.id}:partial`, text: `${library.name}(部分)`, libraryId: library.id, kind: 'library' });
        }
        continue;
      }
      const allTagsSelected = allTagIds.length > 0 && selectedTags.length === allTagIds.length;
      if (allTagsSelected) {
        badges.push({ key: library.id, text: `${library.name}(全部)`, libraryId: library.id, kind: 'library' });
      } else if (selectedTags.length > 0) {
        badges.push({ key: library.id, text: `${library.name}(部分)`, libraryId: library.id, kind: 'library' });
      }
    }
    return badges;
  });

  const toggleScopeLibrary = (id: string) => {
    const library = allScopeLibraries.value.find((item) => item.id === id);
    if (selectedScopeIds.value.includes(id)) {
      selectedScopeIds.value = selectedScopeIds.value.filter((scopeId) => scopeId !== id);
      removeLibraryPreciseSelection([id]);
    } else {
      selectedScopeIds.value = [...selectedScopeIds.value, id];
      if (library) {
        selectedTagIds.value = Array.from(new Set([...selectedTagIds.value, ...collectLibraryTagIds(library)]));
      }
      activeScopeLibraryId.value = id;
    }
  };

  const isScopeGroupAllSelected = (group: ScopeGroup) => {
    return group.libraries.every((library) => selectedScopeIds.value.includes(library.id));
  };

  const toggleScopeGroup = (group: ScopeGroup) => {
    const libraryIds = group.libraries.map((library) => library.id);
    if (isScopeGroupAllSelected(group)) {
      selectedScopeIds.value = selectedScopeIds.value.filter((id) => !libraryIds.includes(id));
      removeLibraryPreciseSelection(libraryIds);
      return;
    }
    selectedScopeIds.value = Array.from(new Set([...selectedScopeIds.value, ...libraryIds]));
    selectedTagIds.value = Array.from(new Set([
      ...selectedTagIds.value,
      ...group.libraries.flatMap(collectLibraryTagIds)
    ]));
    activeScopeLibraryId.value = libraryIds[0] || activeScopeLibraryId.value;
  };

  const toggleValue = (listRef: typeof selectedTagIds, id: string) => {
    listRef.value = listRef.value.includes(id) ? listRef.value.filter((item) => item !== id) : [...listRef.value, id];
  };

  const syncLibrarySelection = (library: ScopeLibrary) => {
    const hasTagSelection = getSelectedLibraryTags(library).length > 0;
    const hasFileSelection = getSelectedLibraryFiles(library).length > 0;
    const isSelected = selectedScopeIds.value.includes(library.id);
    if ((hasTagSelection || hasFileSelection) && !isSelected) {
      selectedScopeIds.value = [...selectedScopeIds.value, library.id];
    }
    if (!hasTagSelection && !hasFileSelection && isSelected) {
      selectedScopeIds.value = selectedScopeIds.value.filter((id) => id !== library.id);
    }
  };

  const ensureLibrarySelected = (library: ScopeLibrary) => {
    if (!selectedScopeIds.value.includes(library.id)) {
      selectedScopeIds.value = [...selectedScopeIds.value, library.id];
    }
  };

  const toggleTag = (id: string) => {
    const library = getLibraryByTagId(id) || activeScopeLibrary.value;
    ensureLibrarySelected(library);
    toggleValue(selectedTagIds, id);
    syncLibrarySelection(library);
  };

  const toggleFile = (id: string) => {
    const library = getLibraryByFileId(id) || activeScopeLibrary.value;
    ensureLibrarySelected(library);
    toggleValue(selectedFileIds, id);
    syncLibrarySelection(library);
  };

  const removeSelectedScopeBadge = (badge: ScopeBadge) => {
    const library = allScopeLibraries.value.find((item) => item.id === badge.libraryId);
    if (!library) return;
    if (badge.kind === 'file' && badge.fileId) {
      selectedFileIds.value = selectedFileIds.value.filter((id) => id !== badge.fileId);
      syncLibrarySelection(library);
      return;
    }
    const tagIds = new Set(collectLibraryTagIds(library));
    selectedTagIds.value = selectedTagIds.value.filter((id) => !tagIds.has(id));
    syncLibrarySelection(library);
  };

  const toggleLibraryAllTags = (library: ScopeLibrary) => {
    const tagIds = collectLibraryTagIds(library);
    ensureLibrarySelected(library);
    if (isLibraryAllTagsSelected(library)) {
      selectedTagIds.value = selectedTagIds.value.filter((id) => !tagIds.includes(id));
      syncLibrarySelection(library);
      return;
    }
    selectedTagIds.value = Array.from(new Set([...selectedTagIds.value, ...tagIds]));
    syncLibrarySelection(library);
  };

  const preparePreciseScope = () => {
    for (const library of selectedScopeLibraries.value) {
      if (getSelectedLibraryTags(library).length === 0 && getSelectedLibraryFiles(library).length === 0) {
        selectedTagIds.value = Array.from(new Set([...selectedTagIds.value, ...collectLibraryTagIds(library)]));
      }
    }
    activeScopeLibraryId.value = selectedScopeLibraries.value[0]?.id || allScopeLibraries.value[0]?.id || activeScopeLibraryId.value;
  };

  const clearScope = () => {
    internetSearchEnabled.value = false;
    selectedScopeIds.value = [];
    selectedTagIds.value = [];
    selectedFileIds.value = [];
  };

  return {
    scopeGroups,
    internetSearchEnabled,
    selectedScopeIds,
    selectedTagIds,
    selectedFileIds,
    activeScopeLibraryId,
    scopeSearchKeyword,
    activeScopeLibrary,
    filteredActiveScopeFiles,
    scopeLabel,
    selectedScopeBadges,
    isLibraryAllTagsSelected,
    isScopeGroupAllSelected,
    toggleScopeLibrary,
    toggleScopeGroup,
    toggleTag,
    toggleFile,
    toggleLibraryAllTags,
    removeSelectedScopeBadge,
    preparePreciseScope,
    clearScope
  };
};
