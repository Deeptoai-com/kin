import type { Dictionary } from 'intlayer';
import { t } from 'intlayer';

/**
 * AI Elements interface content dictionary
 * Contains labels for AI SDK UI components (prompt-input, reasoning, tool, etc.)
 */
const aiElementsContent = {
  content: {
    // Prompt Input Component
    promptInput: {
      placeholder: t({
        en: 'What would you like to know?',
        'zh-Hans': '您想了解什么？',
        fr: 'Que souhaitez-vous savoir ?',
        ja: '何を知りたいですか？',
        ko: '무엇이 궁금하신가요?',
        'zh-Hant': '您想了解什麼？',
      }),
      addAttachments: t({
        en: 'Add photos or files',
        'zh-Hans': '添加图片或文件',
        fr: 'Ajouter des photos ou fichiers',
        ja: '写真やファイルを追加',
        ko: '사진 또는 파일 추가',
        'zh-Hant': '新增圖片或檔案',
      }),
      removeAttachment: t({
        en: 'Remove attachment',
        'zh-Hans': '移除附件',
        fr: 'Retirer la pièce jointe',
        ja: '添付を削除',
        ko: '첨부 제거',
        'zh-Hant': '移除附件',
      }),
      uploadFiles: t({
        en: 'Upload files',
        'zh-Hans': '上传文件',
        fr: 'Télécharger des fichiers',
        ja: 'ファイルをアップロード',
        ko: '파일 업로드',
        'zh-Hant': '上傳檔案',
      }),
      submit: t({
        en: 'Submit',
        'zh-Hans': '提交',
        fr: 'Envoyer',
        ja: '送信',
        ko: '제출',
        'zh-Hant': '提交',
      }),
      unknownFile: t({
        en: 'Unknown file',
        'zh-Hans': '未知文件',
        fr: 'Fichier inconnu',
        ja: '不明なファイル',
        ko: '알 수 없는 파일',
        'zh-Hant': '未知檔案',
      }),
      errors: {
        accept: t({
          en: 'No files match the accepted types.',
          'zh-Hans': '没有文件符合接受的类型。',
          fr: 'Aucun fichier ne correspond aux types acceptés.',
          ja: '受け付けられる形式のファイルがありません。',
          ko: '허용된 형식에 맞는 파일이 없습니다.',
          'zh-Hant': '沒有檔案符合接受的類型。',
        }),
        maxSize: t({
          en: 'All files exceed the maximum size.',
          'zh-Hans': '所有文件都超过了最大大小限制。',
          fr: 'Tous les fichiers dépassent la taille maximale.',
          ja: 'すべてのファイルが最大サイズを超えています。',
          ko: '모든 파일이 최대 크기를 초과했습니다.',
          'zh-Hant': '所有檔案皆超過最大大小限制。',
        }),
        maxFiles: t({
          en: 'Too many files. Some were not added.',
          'zh-Hans': '文件太多，部分未被添加。',
          fr: 'Trop de fichiers. Certains n\'ont pas été ajoutés.',
          ja: 'ファイルが多すぎます。一部は追加されませんでした。',
          ko: '파일이 너무 많습니다. 일부는 추가되지 않았습니다.',
          'zh-Hant': '檔案太多，部分未被新增。',
        }),
      },
    },

    // Reasoning Component
    reasoning: {
      thinking: t({
        en: 'Thinking...',
        'zh-Hans': '思考中...',
        fr: 'Réflexion...',
        ja: '考え中...',
        ko: '생각 중...',
        'zh-Hant': '思考中...',
      }),
      thoughtFewSeconds: t({
        en: 'Thought for a few seconds',
        'zh-Hans': '思考了几秒',
        fr: 'Réflexion de quelques secondes',
        ja: '数秒考えました',
        ko: '몇 초간 생각함',
        'zh-Hant': '思考了幾秒',
      }),
      thoughtSeconds: t({
        en: 'Thought for {count} seconds',
        'zh-Hans': '思考了 {count} 秒',
        fr: 'Réflexion de {count} secondes',
        ja: '{count} 秒考えました',
        ko: '{count}초간 생각함',
        'zh-Hant': '思考了 {count} 秒',
      }),
    },

    // Session Sidebar
    sessionSidebar: {
      title: t({ en: 'Sessions', 'zh-Hans': '会话', fr: 'Sessions', ja: 'セッション', ko: '세션', 'zh-Hant': '會話' }),
      newSession: t({ en: 'New session', 'zh-Hans': '新建会话', fr: 'Nouvelle session', ja: '新規セッション', ko: '새 세션', 'zh-Hant': '新建會話' }),
      noSessionsYet: t({ en: 'No sessions yet', 'zh-Hans': '暂无会话', fr: 'Aucune session', ja: 'セッションはまだありません', ko: '아직 세션 없음', 'zh-Hant': '暫無會話' }),
      clickToCreate: t({ en: 'Click + to create a new session', 'zh-Hans': '点击 + 创建新会话', fr: 'Cliquez + pour créer une session', ja: '+ をクリックして新規セッションを作成', ko: '+ 를 눌러 새 세션 만들기', 'zh-Hant': '點擊 + 建立新會話' }),
    },

    // Chat surface (empty state, composer)
    chatSurface: {
      startConversation: t({ en: 'Start a conversation', 'zh-Hans': '开始对话', fr: 'Commencer une conversation', ja: '会話を開始', ko: '대화 시작', 'zh-Hant': '開始對話' }),
      askAnything: t({ en: 'Ask me anything about your codebase.', 'zh-Hans': '关于代码库的任何问题都可以问我。', fr: 'Posez-moi des questions sur votre code.', ja: 'コードベースについて何でも聞いてください。', ko: '코드베이스에 대해 무엇이든 물어보세요.', 'zh-Hant': '關於程式庫的任何問題都可以問我。' }),
      typeYourMessage: t({ en: 'Type your message...', 'zh-Hans': '输入消息...', fr: 'Saisissez votre message...', ja: 'メッセージを入力...', ko: '메시지를 입력하세요...', 'zh-Hant': '輸入訊息...' }),
      send: t({ en: 'Send', 'zh-Hans': '发送', fr: 'Envoyer', ja: '送信', ko: '보내기', 'zh-Hant': '傳送' }),
      retry: t({ en: 'Retry', 'zh-Hans': '重试', fr: 'Réessayer', ja: '再試行', ko: '다시 시도', 'zh-Hant': '重試' }),
      copy: t({ en: 'Copy', 'zh-Hans': '复制', fr: 'Copier', ja: 'コピー', ko: '복사', 'zh-Hant': '複製' }),
      startOrSelect: t({
        en: 'Start a conversation or select a session from the sidebar',
        'zh-Hans': '开始对话或从侧栏选择会话',
        fr: 'Commencer une conversation ou sélectionner une session dans la barre',
        ja: '会話を開始するか、サイドバーからセッションを選択',
        ko: '대화를 시작하거나 사이드바에서 세션 선택',
        'zh-Hant': '開始對話或從側欄選擇會話',
      }),
    },

    // Tool Component
    tool: {
      status: {
        pending: t({ en: 'Pending', 'zh-Hans': '等待中', fr: 'En attente', ja: '待機中', ko: '대기 중', 'zh-Hant': '等待中' }),
        running: t({ en: 'Running', 'zh-Hans': '运行中', fr: 'En cours', ja: '実行中', ko: '실행 중', 'zh-Hant': '執行中' }),
        completed: t({ en: 'Completed', 'zh-Hans': '已完成', fr: 'Terminé', ja: '完了', ko: '완료', 'zh-Hant': '已完成' }),
        error: t({ en: 'Error', 'zh-Hans': '错误', fr: 'Erreur', ja: 'エラー', ko: '오류', 'zh-Hant': '錯誤' }),
      },
      parameters: t({ en: 'Parameters', 'zh-Hans': '参数', fr: 'Paramètres', ja: 'パラメータ', ko: '매개변수', 'zh-Hant': '參數' }),
      result: t({ en: 'Result', 'zh-Hans': '结果', fr: 'Résultat', ja: '結果', ko: '결과', 'zh-Hant': '結果' }),
      errorLabel: t({ en: 'Error', 'zh-Hans': '错误', fr: 'Erreur', ja: 'エラー', ko: '오류', 'zh-Hant': '錯誤' }),
    },

    // Code Block Component
    codeBlock: {
      copy: t({ en: 'Copy', 'zh-Hans': '复制', fr: 'Copier', ja: 'コピー', ko: '복사', 'zh-Hant': '複製' }),
      copied: t({ en: 'Copied!', 'zh-Hans': '已复制！', fr: 'Copié !', ja: 'コピーしました！', ko: '복사됨!', 'zh-Hant': '已複製！' }),
    },

    // Message Component
    message: {
      user: t({ en: 'You', 'zh-Hans': '你', fr: 'Vous', ja: 'あなた', ko: '사용자', 'zh-Hant': '您' }),
      assistant: t({ en: 'Assistant', 'zh-Hans': '助手', fr: 'Assistant', ja: 'アシスタント', ko: '어시스턴트', 'zh-Hant': '助手' }),
    },
  },
  key: 'ai-elements',
} satisfies Dictionary;

export default aiElementsContent;
