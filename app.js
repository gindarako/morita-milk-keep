document.getElementById('generateBtn').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value;
    const charName = document.getElementById('charName').value;
    const theme = document.getElementById('theme').value;

    if (!charName || !theme) {
        alert("キャラクター名とモチーフ・雰囲気を入力してください！");
        return;
    }

    // UI要素
    const loading = document.getElementById('loading');
    const resultImage = document.getElementById('resultImage');
    const errorMsg = document.getElementById('errorMsg');

    // UIリセット
    loading.classList.remove('hidden');
    resultImage.classList.add('hidden');
    errorMsg.classList.add('hidden');

    // 理想的なNano Banana向けプロンプトの作成
    const prompt = `
        2D, Kawaii, flat vector style VTuber typography logo for "${charName}". 
        The theme and motif is "${theme}".
        Vibrant pastel colors, thick white outline, decorative cute elements around the text.
        Pop, retro-pop, Y2K aesthetic, highly detailed sticker-like logo, transparent background style.
        High quality, masterpiece.
    `;

    try {
        // ※ ここはNano Banana (Gemini 2.5 Flash Image) APIを叩く実際の処理に置き換えます。
        // APIの仕様に合わせてエンドポイントとペイロードを調整します。
        // 現在はAPI連携のダミーコードとして、ローディング後にモック画像(スタイル用のダミー)を表示します。

        // 実際のAPI通信の例（Fetch）:
        /*
        const response = await fetch('YOUR_NANO_BANANA_API_ENDPOINT', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({ prompt: prompt })
        });
        const data = await response.json();
        const imageUrl = data.image_url;
        */

        // ダミーの遅延処理（3秒）
        await new Promise(resolve => setTimeout(resolve, 3000));

        // モック画像（プレースホルダー）を表示
        const mockImageUrl = `https://placehold.co/600x300/fecdd3/ec4899?text=${encodeURIComponent(charName + '\n(' + theme + ')')}&font=montserrat`;

        resultImage.src = mockImageUrl;
        resultImage.classList.remove('hidden');

        // もしコンソールでプロンプトを確認したい場合
        console.log("Generated Prompt for Nano Banana:\n", prompt);

    } catch (error) {
        console.error("生成エラー:", error);
        errorMsg.textContent = "画像の生成に失敗しました。APIキーや設定を確認してください。";
        errorMsg.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
});
