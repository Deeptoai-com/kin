import type { Dictionary } from 'intlayer';
import { t } from 'intlayer';

const documentsContent = {
  content: {
    // Sidebar navigation
    sidebar: {
      title: t({ en: 'Files', 'zh-Hans': '文件', fr: 'Fichiers', ja: 'ファイル', ko: '파일', 'zh-Hant': '檔案' }),
      allFiles: t({ en: 'All Files', 'zh-Hans': 'All Files', fr: 'Tous les fichiers', ja: 'すべてのファイル', ko: '모든 파일', 'zh-Hant': '所有檔案' }),
      documents: t({ en: 'Documents', 'zh-Hans': 'Documents', fr: 'Documents', ja: 'ドキュメント', ko: '문서', 'zh-Hant': '文件' }),
      images: t({ en: 'Images', 'zh-Hans': 'Images', fr: 'Images', ja: '画像', ko: '이미지', 'zh-Hant': '圖片' }),
      audio: t({ en: 'Audio', 'zh-Hans': 'Audio', fr: 'Audio', ja: '音声', ko: '오디오', 'zh-Hant': '音訊' }),
      videos: t({ en: 'Videos', 'zh-Hans': 'Videos', fr: 'Vidéos', ja: '動画', ko: '동영상', 'zh-Hant': '影片' }),
      knowledgeBase: t({ en: 'Knowledge Base', 'zh-Hans': '知识库', fr: 'Base de connaissances', ja: 'ナレッジベース', ko: '지식베이스', 'zh-Hant': '知識庫' }),
      allKbFiles: t({ en: 'All KB Files', 'zh-Hans': 'All KB Files', fr: 'Tous les fichiers KB', ja: 'すべてのKBファイル', ko: '모든 KB 파일', 'zh-Hant': '所有 KB 檔案' }),
      createKb: t({ en: 'Create new knowledge base', 'zh-Hans': '创建新知识库', fr: 'Créer une base de connaissances', ja: '新規ナレッジベースを作成', ko: '새 지식베이스 만들기', 'zh-Hant': '建立新知識庫' }),
    },

    // Main toolbar
    toolbar: {
      searchPlaceholder: t({ en: 'Search files', 'zh-Hans': '搜索文件', fr: 'Rechercher des fichiers', ja: 'ファイルを検索', ko: '파일 검색', 'zh-Hant': '搜尋檔案' }),
      uploadButton: t({ en: 'Upload', 'zh-Hans': '上传', fr: 'Télécharger', ja: 'アップロード', ko: '업로드', 'zh-Hant': '上傳' }),
      editButton: t({ en: 'Edit', 'zh-Hans': '编辑', fr: 'Modifier', ja: '編集', ko: '편집', 'zh-Hant': '編輯' }),
      deleteButton: t({ en: 'Delete', 'zh-Hans': '删除', fr: 'Supprimer', ja: '削除', ko: '삭제', 'zh-Hant': '刪除' }),
      deleting: t({ en: 'Deleting…', 'zh-Hans': '删除中…', fr: 'Suppression…', ja: '削除中…', ko: '삭제 중…', 'zh-Hant': '刪除中…' }),
    },

    // Delete confirmation
    deleteConfirm: {
      kb: t({
        en: 'Delete "{name}"? This will not delete the documents themselves.',
        'zh-Hans': '删除 "{name}"？这不会删除文档本身。',
        fr: 'Supprimer "{name}" ? Les documents ne seront pas supprimés.',
        ja: '"{name}" を削除しますか？ドキュメント自体は削除されません。',
        ko: '"{name}"(을)를 삭제할까요? 문서 자체는 삭제되지 않습니다.',
        'zh-Hant': '刪除 "{name}"？這不會刪除文件本身。',
      }),
      removeDoc: t({
        en: 'Remove "{name}" from this knowledge base?',
        'zh-Hans': '从知识库中移除 "{name}"？',
        fr: 'Retirer "{name}" de cette base de connaissances ?',
        ja: 'このナレッジベースから "{name}" を削除しますか？',
        ko: '이 지식베이스에서 "{name}"(을)를 제거할까요?',
        'zh-Hant': '從知識庫中移除 "{name}"？',
      }),
    },

    // Header row
    header: {
      allFiles: t({ en: 'All Files', 'zh-Hans': 'All Files', fr: 'Tous les fichiers', ja: 'すべてのファイル', ko: '모든 파일', 'zh-Hant': '所有檔案' }),
      total: t({ en: 'Total {count}', 'zh-Hans': '共 {count}', fr: 'Total {count}', ja: '合計 {count}', ko: '총 {count}', 'zh-Hant': '共 {count}' }),
      kbDocuments: t({ en: 'Documents in this KB', 'zh-Hans': '此知识库中的文档', fr: 'Documents dans cette base', ja: 'このKBのドキュメント', ko: '이 KB의 문서', 'zh-Hant': '此知識庫中的文件' }),
      addDocuments: t({ en: 'Add Documents', 'zh-Hans': '添加文档', fr: 'Ajouter des documents', ja: 'ドキュメントを追加', ko: '문서 추가', 'zh-Hant': '新增文件' }),
      showInKb: t({ en: 'Show content in Knowledge Base', 'zh-Hans': '在知识库中显示内容', fr: 'Afficher dans la base de connaissances', ja: 'ナレッジベースに表示', ko: '지식베이스에 표시', 'zh-Hant': '在知識庫中顯示內容' }),
    },

    // File table
    table: {
      file: t({ en: 'File', 'zh-Hans': '文件', fr: 'Fichier', ja: 'ファイル', ko: '파일', 'zh-Hant': '檔案' }),
      createdAt: t({ en: 'Created At', 'zh-Hans': '创建时间', fr: 'Créé le', ja: '作成日時', ko: '생성일', 'zh-Hant': '建立時間' }),
      size: t({ en: 'Size', 'zh-Hans': '大小', fr: 'Taille', ja: 'サイズ', ko: '크기', 'zh-Hant': '大小' }),
      noDocuments: t({ en: 'No documents found.', 'zh-Hans': '未找到文档。', fr: 'Aucun document trouvé.', ja: 'ドキュメントが見つかりません。', ko: '문서를 찾을 수 없습니다.', 'zh-Hant': '未找到文件。' }),
      selectAll: t({ en: 'Select all', 'zh-Hans': '全选', fr: 'Tout sélectionner', ja: 'すべて選択', ko: '전체 선택', 'zh-Hant': '全選' }),
      selectFile: t({ en: 'Select {name}', 'zh-Hans': '选择 {name}', fr: 'Sélectionner {name}', ja: '{name} を選択', ko: '{name} 선택', 'zh-Hant': '選擇 {name}' }),
    },

    // KB document list
    kbList: {
      noDocuments: t({ en: 'No documents in this knowledge base', 'zh-Hans': '此知识库中没有文档', fr: 'Aucun document dans cette base', ja: 'このKBにドキュメントはありません', ko: '이 지식베이스에 문서가 없습니다', 'zh-Hant': '此知識庫中沒有文件' }),
      getStarted: t({ en: 'Click "Add Documents" to get started', 'zh-Hans': '点击"添加文档"开始', fr: 'Cliquez sur "Ajouter des documents" pour commencer', ja: '「ドキュメントを追加」をクリックして開始', ko: '"문서 추가"를 클릭하여 시작', 'zh-Hant': '點擊「新增文件」開始' }),
      removeFromKb: t({ en: 'Remove from KB', 'zh-Hans': '从知识库移除', fr: 'Retirer de la base', ja: 'KBから削除', ko: 'KB에서 제거', 'zh-Hant': '從知識庫移除' }),
      unknownType: t({ en: 'Unknown type', 'zh-Hans': '未知类型', fr: 'Type inconnu', ja: '不明なタイプ', ko: '알 수 없는 유형', 'zh-Hant': '未知類型' }),
    },

    // Selected files bar
    selectedBar: {
      selected: t({ en: '{count} selected', 'zh-Hans': '已选择 {count}', fr: '{count} sélectionné(s)', ja: '{count} 件選択', ko: '{count}개 선택됨', 'zh-Hant': '已選擇 {count}' }),
      clear: t({ en: 'Clear', 'zh-Hans': '清除', fr: 'Effacer', ja: 'クリア', ko: '지우기', 'zh-Hant': '清除' }),
      delete: t({ en: 'Delete', 'zh-Hans': '删除', fr: 'Supprimer', ja: '削除', ko: '삭제', 'zh-Hant': '刪除' }),
    },

    // Upload dialog
    upload: {
      title: t({ en: 'Upload document', 'zh-Hans': '上传文档', fr: 'Télécharger un document', ja: 'ドキュメントをアップロード', ko: '문서 업로드', 'zh-Hant': '上傳文件' }),
      titleLabel: t({ en: 'Title', 'zh-Hans': '标题', fr: 'Titre', ja: 'タイトル', ko: '제목', 'zh-Hant': '標題' }),
      titlePlaceholder: t({ en: 'Title', 'zh-Hans': '标题', fr: 'Titre', ja: 'タイトル', ko: '제목', 'zh-Hant': '標題' }),
      textLabel: t({ en: 'Document Text', 'zh-Hans': '文档文本', fr: 'Texte du document', ja: 'ドキュメントテキスト', ko: '문서 텍스트', 'zh-Hant': '文件文字' }),
      textPlaceholder: t({ en: 'Paste text here…', 'zh-Hans': '在此粘贴文本…', fr: 'Collez le texte ici…', ja: 'ここにテキストを貼り付け…', ko: '여기에 텍스트 붙여넣기…', 'zh-Hant': '在此貼上文字…' }),
      attachFiles: t({ en: 'Attach files', 'zh-Hans': '附加文件', fr: 'Joindre des fichiers', ja: 'ファイルを添付', ko: '파일 첨부', 'zh-Hant': '附加檔案' }),
      selectFiles: t({ en: 'Select Files', 'zh-Hans': '选择文件', fr: 'Sélectionner des fichiers', ja: 'ファイルを選択', ko: '파일 선택', 'zh-Hant': '選擇檔案' }),
      clearAll: t({ en: 'Clear All', 'zh-Hans': '全部清除', fr: 'Tout effacer', ja: 'すべてクリア', ko: '전체 지우기', 'zh-Hant': '全部清除' }),
      uploading: t({ en: 'Uploading…', 'zh-Hans': '上传中…', fr: 'Téléchargement…', ja: 'アップロード中…', ko: '업로드 중…', 'zh-Hant': '上傳中…' }),
      upload: t({ en: 'Upload', 'zh-Hans': '上传', fr: 'Télécharger', ja: 'アップロード', ko: '업로드', 'zh-Hant': '上傳' }),
      unknownError: t({ en: 'An unknown error occurred during upload.', 'zh-Hans': '上传时发生未知错误。', fr: 'Une erreur inconnue s\'est produite lors du téléchargement.', ja: 'アップロード中に不明なエラーが発生しました。', ko: '업로드 중 알 수 없는 오류가 발생했습니다.', 'zh-Hant': '上傳時發生未知錯誤。' }),
    },

    // Create KB dialog
    createKb: {
      title: t({ en: 'Create Knowledge Base', 'zh-Hans': '创建知识库', fr: 'Créer une base de connaissances', ja: 'ナレッジベースを作成', ko: '지식베이스 만들기', 'zh-Hant': '建立知識庫' }),
      nameLabel: t({ en: 'Name', 'zh-Hans': '名称', fr: 'Nom', ja: '名前', ko: '이름', 'zh-Hant': '名稱' }),
      namePlaceholder: t({ en: 'e.g., Python Programming', 'zh-Hans': '例如：Python 编程', fr: 'ex. Programmation Python', ja: '例：Python プログラミング', ko: '예: Python 프로그래밍', 'zh-Hant': '例如：Python 程式設計' }),
      descriptionLabel: t({ en: 'Description', 'zh-Hans': '描述', fr: 'Description', ja: '説明', ko: '설명', 'zh-Hant': '描述' }),
      descriptionPlaceholder: t({ en: 'Optional description...', 'zh-Hans': '可选描述...', fr: 'Description optionnelle...', ja: '任意の説明...', ko: '선택 설명...', 'zh-Hant': '選填描述...' }),
      create: t({ en: 'Create', 'zh-Hans': '创建', fr: 'Créer', ja: '作成', ko: '만들기', 'zh-Hant': '建立' }),
      creating: t({ en: 'Creating…', 'zh-Hans': '创建中…', fr: 'Création…', ja: '作成中…', ko: '만드는 중…', 'zh-Hant': '建立中…' }),
      error: t({ en: 'Failed to create knowledge base', 'zh-Hans': '创建知识库失败', fr: 'Échec de la création de la base', ja: 'ナレッジベースの作成に失敗しました', ko: '지식베이스 생성 실패', 'zh-Hant': '建立知識庫失敗' }),
    },

    // Edit KB dialog
    editKb: {
      title: t({ en: 'Edit Knowledge Base', 'zh-Hans': '编辑知识库', fr: 'Modifier la base de connaissances', ja: 'ナレッジベースを編集', ko: '지식베이스 편집', 'zh-Hant': '編輯知識庫' }),
      nameLabel: t({ en: 'Name', 'zh-Hans': '名称', fr: 'Nom', ja: '名前', ko: '이름', 'zh-Hant': '名稱' }),
      namePlaceholder: t({ en: 'e.g., Python Programming', 'zh-Hans': '例如：Python 编程', fr: 'ex. Programmation Python', ja: '例：Python プログラミング', ko: '예: Python 프로그래밍', 'zh-Hant': '例如：Python 程式設計' }),
      descriptionLabel: t({ en: 'Description', 'zh-Hans': '描述', fr: 'Description', ja: '説明', ko: '설명', 'zh-Hant': '描述' }),
      descriptionPlaceholder: t({ en: 'Optional description...', 'zh-Hans': '可选描述...', fr: 'Description optionnelle...', ja: '任意の説明...', ko: '선택 설명...', 'zh-Hant': '選填描述...' }),
      save: t({ en: 'Save', 'zh-Hans': '保存', fr: 'Enregistrer', ja: '保存', ko: '저장', 'zh-Hant': '儲存' }),
      saving: t({ en: 'Saving…', 'zh-Hans': '保存中…', fr: 'Enregistrement…', ja: '保存中…', ko: '저장 중…', 'zh-Hant': '儲存中…' }),
      error: t({ en: 'Failed to update knowledge base', 'zh-Hans': '更新知识库失败', fr: 'Échec de la mise à jour de la base', ja: 'ナレッジベースの更新に失敗しました', ko: '지식베이스 업데이트 실패', 'zh-Hant': '更新知識庫失敗' }),
    },

    // Document Selector Modal (used in KB and Claude Chat)
    selector: {
      title: t({ en: 'Select documents to add to knowledge base', 'zh-Hans': '选择文档添加到知识库', fr: 'Sélectionner les documents à ajouter', ja: 'ナレッジベースに追加するドキュメントを選択', ko: '지식베이스에 추가할 문서 선택', 'zh-Hant': '選擇文件加入知識庫' }),
      close: t({ en: 'Close', 'zh-Hans': '关闭', fr: 'Fermer', ja: '閉じる', ko: '닫기', 'zh-Hant': '關閉' }),
      searchPlaceholder: t({ en: 'Search documents...', 'zh-Hans': '搜索文档...', fr: 'Rechercher des documents...', ja: 'ドキュメントを検索...', ko: '문서 검색...', 'zh-Hant': '搜尋文件...' }),
      loading: t({ en: 'Loading...', 'zh-Hans': '加载中...', fr: 'Chargement...', ja: '読み込み中...', ko: '로딩 중...', 'zh-Hant': '載入中...' }),
      loadError: t({ en: 'Failed to load documents', 'zh-Hans': '加载文档失败', fr: 'Échec du chargement des documents', ja: 'ドキュメントの読み込みに失敗しました', ko: '문서 로드 실패', 'zh-Hant': '載入文件失敗' }),
      noDocuments: t({ en: 'No available documents', 'zh-Hans': '暂无可用文档', fr: 'Aucun document disponible', ja: '利用可能なドキュメントがありません', ko: '사용 가능한 문서 없음', 'zh-Hant': '暫無可用文件' }),
      noResults: t({ en: 'No matching documents found', 'zh-Hans': '未找到匹配的文档', fr: 'Aucun document correspondant', ja: '一致するドキュメントが見つかりません', ko: '일치하는 문서 없음', 'zh-Hant': '未找到符合的文件' }),
      selectAll: t({ en: 'Select All', 'zh-Hans': '全选', fr: 'Tout sélectionner', ja: 'すべて選択', ko: '전체 선택', 'zh-Hant': '全選' }),
      deselectAll: t({ en: 'Deselect All', 'zh-Hans': '取消全选', fr: 'Tout désélectionner', ja: '選択解除', ko: '선택 해제', 'zh-Hant': '取消全選' }),
      selected: t({ en: '{count} selected', 'zh-Hans': '已选择 {count}', fr: '{count} sélectionné(s)', ja: '{count} 件選択', ko: '{count}개 선택됨', 'zh-Hant': '已選擇 {count}' }),
      cancel: t({ en: 'Cancel', 'zh-Hans': '取消', fr: 'Annuler', ja: 'キャンセル', ko: '취소', 'zh-Hant': '取消' }),
      adding: t({ en: 'Adding...', 'zh-Hans': '添加中...', fr: 'Ajout...', ja: '追加中...', ko: '추가 중...', 'zh-Hant': '新增中...' }),
      addToSession: t({ en: 'Add to Session', 'zh-Hans': '添加到会话', fr: 'Ajouter à la session', ja: 'セッションに追加', ko: '세션에 추가', 'zh-Hant': '加入會話' }),
      addFailed: t({ en: 'Failed to add documents. Please try again.', 'zh-Hans': '添加文档失败，请重试。', fr: 'Échec de l\'ajout. Veuillez réessayer.', ja: 'ドキュメントの追加に失敗しました。再試行してください。', ko: '문서 추가 실패. 다시 시도해 주세요.', 'zh-Hant': '新增文件失敗，請重試。' }),
    },

    // Navigation sidebar (NavDocuments component)
    navDocuments: {
      title: t({ en: 'Documents', 'zh-Hans': 'Documents', fr: 'Documents', ja: 'ドキュメント', ko: '문서', 'zh-Hant': '文件' }),
      more: t({ en: 'More', 'zh-Hans': '更多', fr: 'Plus', ja: 'その他', ko: '더보기', 'zh-Hant': '更多' }),
      open: t({ en: 'Open', 'zh-Hans': '打开', fr: 'Ouvrir', ja: '開く', ko: '열기', 'zh-Hant': '開啟' }),
      share: t({ en: 'Share', 'zh-Hans': '分享', fr: 'Partager', ja: '共有', ko: '공유', 'zh-Hant': '分享' }),
      delete: t({ en: 'Delete', 'zh-Hans': '删除', fr: 'Supprimer', ja: '削除', ko: '삭제', 'zh-Hant': '刪除' }),
    },
  },
  key: 'documents',
} satisfies Dictionary;

export default documentsContent;
