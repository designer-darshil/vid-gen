import CreativeEditorSDK from '@cesdk/cesdk-js';

const container = document.getElementById('cesdk_container');

const config = {
  baseURL: 'https://cdn.img.ly/packages/imgly/cesdk-js/1.84.0/assets',
  theme: 'dark',
  ui: {
    elements: {
      view: 'default',
      navigation: {
        action: {
          export: true
        }
      }
    }
  }
};

CreativeEditorSDK.create(container, config)
  .then(async (cesdk) => {
    console.log('[POC] CE.SDK initialized successfully:', cesdk);
    await cesdk.actions.run('scene.create');
  })
  .catch((err) => {
    console.error('[POC] CE.SDK initialization error:', err);
    container.innerHTML = `<div style="padding: 30px;"><h2>CE.SDK Initialization Notice</h2><p>${err.message}</p></div>`;
  });
