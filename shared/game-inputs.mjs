const invalid=message=>Object.assign(new Error(message),{statusCode:400});
const booleanFields=['server_required','region_required','password_required','character_required'];
const allowed=new Set(['guide','custom_fields','server_options','region_options',...booleanFields]);
const normalizeLabel=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const builtInFields={
  uid:new Set(['uid','uid nguoi choi']),
  login:new Set(['tai khoan','tai khoan game','ten tai khoan','ten tkhoan','username','user name','mat khau','mat khau game','thong tin them','zalo','zalo lien he','ghi chu','ghi chu cua khach']),
};
export function normalizeGameInputs(value={},mode='uid'){
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!allowed.has(key)))throw invalid('Cấu hình thông tin nạp không hợp lệ.');
  const guide=value.guide??'';
  if(typeof guide!=='string' || guide.length>3000)throw invalid('Hướng dẫn tối đa 3.000 ký tự.');
  const result={guide:guide.trim(),custom_fields:[]};
  const custom=value.custom_fields??[];
  if(!Array.isArray(custom) || custom.length>20 || custom.some(item=>typeof item!=='string' || !item.trim() || item.length>80))throw invalid('Danh sách thông tin tối đa 20 dòng, mỗi dòng 1–80 ký tự.');
  const reserved=builtInFields[mode]||builtInFields.uid;
  result.custom_fields=[...new Set(custom.map(item=>item.trim()).filter(item=>!reserved.has(normalizeLabel(item))))];
  for(const field of booleanFields){if(value[field]!==undefined && typeof value[field]!=='boolean')throw invalid('Cấu hình bắt buộc phải là bật/tắt.');result[field]=value[field]??(field==='password_required'&&mode==='login');}
  for(const field of ['server_options','region_options']){
    const list=value[field]??[];
    if(!Array.isArray(list) || list.length>30 || list.some(item=>typeof item!=='string' || !item.trim() || item.length>80))throw invalid('Mỗi danh sách tối đa 30 mục, mỗi mục 1–80 ký tự.');
    result[field]=list.map(item=>item.trim());
    if(new Set(result[field]).size!==result[field].length)throw invalid('Máy chủ/khu vực không được trùng nhau.');
  }
  if(mode!=='login' && result.password_required)throw invalid('Chỉ game nạp login mới được yêu cầu mật khẩu.');
  return result;
}
export function validateGameTarget(mode,configuration,input){
  const config=normalizeGameInputs(configuration||{},mode);
  const primary=mode==='login'?'login':'uid';
  if(typeof input[primary]!=='string' || !input[primary].trim())throw invalid(mode==='login'?'Vui lòng nhập tài khoản game.':'Vui lòng nhập UID người chơi.');
  const result={[primary]:input[primary].trim()};
  if(input.password && !config.password_required)throw invalid('Game này không yêu cầu mật khẩu.');
  if(config.password_required){if(typeof input.password!=='string' || !input.password)throw invalid('Vui lòng nhập mật khẩu game.');result.password=input.password;}
  for(const field of ['server','region']){
    const value=String(input[field]||'').trim();
    if(config[field+'_required'] && !value)throw invalid(field==='server'?'Vui lòng chọn máy chủ.':'Vui lòng chọn khu vực.');
    if(value && config[field+'_options'].length && !config[field+'_options'].includes(value))throw invalid('Máy chủ hoặc khu vực không nằm trong danh sách của game.');
    if(value)result[field]=value;
  }
  if(config.character_required){if(!input.character?.trim())throw invalid('Vui lòng nhập tên nhân vật.');result.character=input.character.trim();}
  if(config.custom_fields.length){
    const custom=input.custom && typeof input.custom==='object' ? input.custom : {};
    result.custom={};
    config.custom_fields.forEach((label,index)=>{const value=String(custom[index]??'').trim();if(!value)throw invalid(`Vui lòng nhập ${label}.`);result.custom[String(index)]=value.slice(0,200);});
  }
  if(mode==='login'){
    const additional=String(input.additional_info||'').trim();
    if(!additional)throw invalid('Vui lòng nhập thông tin thêm.');
    const zalo=String(input.zalo||'').trim();
    if(!zalo)throw invalid('Vui lòng nhập Zalo liên hệ.');
    result.additional_info=additional.slice(0,1000);result.zalo=zalo.slice(0,120);
    const note=String(input.note||'').trim();if(note)result.note=note.slice(0,1000);
  }
  return result;
}
