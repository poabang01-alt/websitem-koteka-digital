<?php

namespace App\Http\Controllers\Koteka;

use App\Models\Koteka\Lead;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\{Http,RateLimiter,Validator};

class LeadController extends Controller
{
    public function store(Request $request)
    {
        $ipKey='koteka:leads:'.hash('sha256',(string)$request->ip());
        if(RateLimiter::tooManyAttempts($ipKey,12))
            return AccessController::jsonError(429,'Terlalu banyak permintaan. Coba lagi nanti.');
        RateLimiter::hit($ipKey,3600);
        $data=$request->all();
        $data['wa']=preg_replace('/\D+/', '',(string)($data['whatsapp']??$data['wa']??''));
        $data['wa']=preg_replace('/^0/','62',$data['wa']);
        if(str_starts_with($data['wa'],'8'))$data['wa']='62'.$data['wa'];
        $data['pesan']=$data['pesan']??$data['message']??null;
        $validator=Validator::make($data,[
            'nama'=>'required|string|min:3|max:90', 'namaBisnis'=>'required|string|min:1|max:120',
            'wa'=>['required','string','regex:/^62\d{9,13}$/'],
            'email'=>'nullable|email|max:120','jenisWebsite'=>'required|string|max:90',
            'anggaran'=>'required|string|max:90','targetSelesai'=>'required|string|max:90',
            'pesan'=>'required|string|min:10|max:2500','kirimVia'=>'required|in:email,whatsapp',
            'persetujuan'=>'required|accepted',
        ]);
        if($validator->fails() || ($data['kirimVia']??'')==='email' && empty($data['email']))
            return AccessController::jsonError(422,'Data konsultasi tidak lengkap atau tidak valid.');
        $lead=Lead::create([
            'nama'=>trim($data['nama']),'nama_bisnis'=>trim($data['namaBisnis']),
            'wa'=>$data['wa'],'email'=>trim((string)($data['email']??'')) ?: null,
            'jenis_website'=>trim($data['jenisWebsite']),'anggaran'=>trim($data['anggaran']),
            'target_selesai'=>trim($data['targetSelesai']),'pesan'=>trim($data['pesan']),
            'kirim_via'=>$data['kirimVia'],'delivery'=>[$data['kirimVia']=>'pending'],
            'read'=>false,'replied'=>false,
        ]);
        $delivery=$this->notify($lead);
        $lead->delivery=$delivery;$lead->save();
        return response()->json(['ok'=>true,'id'=>$lead->id,'stored'=>true,'delivery'=>$delivery],201)
            ->header('Cache-Control','no-store');
    }

    private function notify(Lead $lead): array
    {
        $result=['email'=>'not_requested','whatsapp'=>'not_requested'];
        $channel=$lead->kirim_via;
        $result[$channel]='not_configured';
        $detail="ID: {$lead->id}\nNama: {$lead->nama}\nBisnis: {$lead->nama_bisnis}\nWhatsApp: {$lead->wa}\nEmail: {$lead->email}\nLayanan: {$lead->jenis_website}\nAnggaran: {$lead->anggaran}\nTarget: {$lead->target_selesai}\nPesan: {$lead->pesan}";
        try {
            if($channel==='email' && config('koteka.resend_api_key') && config('koteka.from_email') && config('koteka.notify_email')) {
                $res=Http::timeout(8)->withToken(config('koteka.resend_api_key'))
                    ->withHeaders(['Idempotency-Key'=>'consultation/'.$lead->id])
                    ->post('https://api.resend.com/emails',[
                        'from'=>config('koteka.from_email'),'to'=>[config('koteka.notify_email')],
                        'reply_to'=>$lead->email,'subject'=>'Konsultasi baru: '.$lead->nama,
                        'text'=>$detail,
                    ]);
                $result['email']=($res->successful() && $res->json('id'))?'sent':'failed';
            } elseif($channel==='whatsapp' && config('koteka.meta_wa_token') && config('koteka.meta_wa_phone_id')
                && config('koteka.meta_wa_to') && config('koteka.meta_wa_template')) {
                $res=Http::timeout(8)->withToken(config('koteka.meta_wa_token'))
                    ->post('https://graph.facebook.com/v23.0/'.rawurlencode(config('koteka.meta_wa_phone_id')).'/messages',[
                        'messaging_product'=>'whatsapp',
                        'to'=>preg_replace('/\D/','',(string)config('koteka.meta_wa_to')),
                        'type'=>'template',
                        'template'=>[
                            'name'=>config('koteka.meta_wa_template'),
                            'language'=>['code'=>config('koteka.meta_wa_language')],
                            'components'=>[['type'=>'body','parameters'=>array_map(fn($txt)=>['type'=>'text','text'=>$txt],
                                [$lead->nama,$lead->nama_bisnis,mb_substr(preg_replace('/\s+/',' ',$detail),0,650)])]],
                        ],
                    ]);
                $result['whatsapp']=($res->successful()&&$res->json('messages.0.id'))?'sent':'failed';
            }
        } catch (\Throwable $e) {
            $result[$channel]='failed';
            report($e);
        }
        return $result;
    }
}
