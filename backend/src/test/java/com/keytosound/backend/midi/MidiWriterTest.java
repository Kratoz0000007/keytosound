package com.keytosound.backend.midi;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.util.List;
import javax.sound.midi.MetaMessage;
import javax.sound.midi.MidiEvent;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.Track;
import org.junit.jupiter.api.Test;

class MidiWriterTest {

    private final MidiWriter writer = new MidiWriter();

    private static Score score() {
        return new Score(
                120,
                "synthLead",
                List.of(new ScoreNote(69, 1.0, 0.5, 0.8), new ScoreNote(72, 1.5, 0.25, 0.6)),
                List.of(new ScoreNote(57, 0.0, 2.0, 0.5), new ScoreNote(60, 0.0, 2.0, 0.5)),
                List.of(new ScoreNote(33, 0.0, 0.25, 0.7)),
                List.of(new DrumHit("kick", 0.0, 0.8), new DrumHit("snare", 0.5, 0.8),
                        new DrumHit("fx", 1.0, 0.8)));
    }

    private static Sequence read(byte[] bytes) throws Exception {
        return MidiSystem.getSequence(new ByteArrayInputStream(bytes));
    }

    private static List<ShortMessage> noteOns(Track track) {
        List<ShortMessage> out = new java.util.ArrayList<>();
        for (int i = 0; i < track.size(); i++) {
            if (track.get(i).getMessage() instanceof ShortMessage m
                    && m.getCommand() == ShortMessage.NOTE_ON && m.getData2() > 0) {
                out.add(m);
            }
        }
        return out;
    }

    private static MidiEvent firstNoteOn(Track track) {
        for (int i = 0; i < track.size(); i++) {
            if (track.get(i).getMessage() instanceof ShortMessage m
                    && m.getCommand() == ShortMessage.NOTE_ON && m.getData2() > 0) {
                return track.get(i);
            }
        }
        throw new AssertionError("no note-on");
    }

    @Test
    void writesAConductorTrackPlusFourInstrumentTracks() throws Exception {
        Sequence seq = read(writer.write("rain", score()));
        assertThat(seq.getTracks()).hasSize(5);
        assertThat(seq.getDivisionType()).isEqualTo(Sequence.PPQ);
        assertThat(seq.getResolution()).isEqualTo(MidiWriter.PPQ);
    }

    @Test
    void storesTheTempo() throws Exception {
        Track conductor = read(writer.write("rain", score())).getTracks()[0];
        int microsPerQuarter = -1;
        for (int i = 0; i < conductor.size(); i++) {
            if (conductor.get(i).getMessage() instanceof MetaMessage m && m.getType() == 0x51) {
                byte[] d = m.getData();
                microsPerQuarter = ((d[0] & 0xff) << 16) | ((d[1] & 0xff) << 8) | (d[2] & 0xff);
            }
        }
        assertThat(microsPerQuarter).isEqualTo(500_000); // 120 bpm
    }

    @Test
    void writesEveryNoteToItsTrack() throws Exception {
        Track[] tracks = read(writer.write("rain", score())).getTracks();
        assertThat(noteOns(tracks[1])).hasSize(2); // lead
        assertThat(noteOns(tracks[2])).hasSize(2); // pad
        assertThat(noteOns(tracks[3])).hasSize(1); // bass
        assertThat(noteOns(tracks[4])).hasSize(3); // drums
    }

    @Test
    void convertsSecondsToTicks() throws Exception {
        Track lead = read(writer.write("rain", score())).getTracks()[1];
        // 1.0s at 120 bpm is 2 beats, and 2 x 480 = 960 ticks.
        assertThat(firstNoteOn(lead).getTick()).isEqualTo(960);
    }

    @Test
    void putsDrumsOnTheGeneralMidiDrumChannelWithStandardNotes() throws Exception {
        List<ShortMessage> drums = noteOns(read(writer.write("rain", score())).getTracks()[4]);
        assertThat(drums).allMatch(m -> m.getChannel() == MidiWriter.DRUM_CHANNEL);
        assertThat(drums).extracting(ShortMessage::getData1).containsExactly(36, 38, 49);
    }

    @Test
    void setsTheLeadProgramFromTheInstrument() throws Exception {
        Track lead = read(writer.write("rain", score())).getTracks()[1];
        int program = -1;
        for (int i = 0; i < lead.size(); i++) {
            if (lead.get(i).getMessage() instanceof ShortMessage m
                    && m.getCommand() == ShortMessage.PROGRAM_CHANGE) {
                program = m.getData1();
            }
        }
        assertThat(program).isEqualTo(81); // GM "Lead 2 (sawtooth)"
    }

    @Test
    void neverWritesAZeroLengthNote() throws Exception {
        Score tiny = new Score(120, "piano", List.of(new ScoreNote(60, 0.0, 0.0001, 0.5)),
                List.of(), List.of(), List.of());
        Track lead = read(writer.write("x", tiny)).getTracks()[1];
        long on = -1;
        long off = -1;
        for (int i = 0; i < lead.size(); i++) {
            if (lead.get(i).getMessage() instanceof ShortMessage m) {
                if (m.getCommand() == ShortMessage.NOTE_ON && m.getData2() > 0) on = lead.get(i).getTick();
                if (m.getCommand() == ShortMessage.NOTE_OFF) off = lead.get(i).getTick();
            }
        }
        assertThat(off).isGreaterThan(on);
    }

    @Test
    void mapsVelocityIntoTheMidiRange() {
        assertThat(MidiWriter.midiVelocity(0.0)).isEqualTo(1);
        assertThat(MidiWriter.midiVelocity(1.0)).isEqualTo(127);
        assertThat(MidiWriter.midiVelocity(0.5)).isEqualTo(64);
    }
}
