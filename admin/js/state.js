// State store for the LiminalOS Admin Panel
export const state = {
    roomsData: {},
    transitionTypes: {},
    imageIndex: { rooms: {}, transitions: {} },
    allInteractables: {},
    mediaLibrary: [],
    currentEditId: null,
    currentContext: 'room', // 'room', 'transition', or 'interactable'
    selectedMediaIds: [],
    systemTaxonomy: [],
    mediaPickerCallback: null,
    editorRequirements: {
        transitions: {}, // category -> reqObj
        interactables: {} // interId -> reqObj
    },
    currentReqTarget: null, // {type, id}
    audioLibrary: [],
    audioMappings: [],
    currentSfxTab: 'bgm', // 'bgm', 'states', 'transitions', 'ui'
    dashboardSearchQuery: '',
    mediaSearchQuery: '',
    audioSearchQuery: '',
    terminalSearchQuery: ''
};

